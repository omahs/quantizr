package quanta.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeProp;
import quanta.model.ipfs.file.IPFSDirStat;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.PublishNodeToIpfsRequest;
import quanta.response.PublishNodeToIpfsResponse;
import quanta.util.ExUtil;
import quanta.util.SubNodeUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;
import static quanta.util.Util.*;

/**
 * 
 * Writes every node under the target subnode (recursively) to an IPFS Mutable File System (MFS) and
 * also removes any existing orphans from underneath the MFS path so that MFS is guaranteed to match
 * the nodes tree perfectly after this operation. The 'pth' (path) property on the node is used as
 * the path for MFS.
 * 
 * Security: Note that for now, until encryption is added we only write the 'public' nodes to IPFS
 * because IPFS is a public system, and currently the simple algo for this is to require that the
 * ACTUAL node being saved into IPFS must itself be 'public' which by deinition means all children
 * of it are public.
 * 
 * Spring 'Prototype-scope Bean': We instantiate a new instance of this bean every time it's run.
 */
@Lazy @Component
@Scope("prototype")
public class SyncToIpfsService  {
	private static final Logger log = LoggerFactory.getLogger(SyncToIpfsService.class);

	@Autowired
	@Lazy
	protected IPFSService ipfs;

	@Autowired
	@Lazy
	private SubNodeUtil snUtil;

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoRead read;

	MongoSession session;

	HashSet<String> allNodePaths = new HashSet<>();
	HashSet<String> allFilePaths = new HashSet<>();

	int totalNodes = 0;
	int orphansRemoved = 0;

	/*
	 * Creates MFS files (a folder structure/tree) that are identical in content to the JSON of each
	 * node, and at the same MFS path as the 'pth' property (Node path)
	 */
	public void writeIpfsFiles(MongoSession ms, PublishNodeToIpfsRequest req, PublishNodeToIpfsResponse res) {
		log.debug("writeIpfsFiles: " + XString.prettyPrint(res));
		ms = ThreadLocals.ensure(ms);
		this.session = ms;
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);

		if (!AclService.isPublic(ms, node)) {
			throw new RuntimeException("This experimental IPFS feature only works for public nodes.");
		}

		boolean success = false;
		try {
			auth.ownerAuth(ms, node);
			Iterable<SubNode> results = read.getSubGraph(ms, node, null, 0, true);

			processNode(node);
			for (SubNode n : results) {
				processNode(n);
			}

			ipfs.flushFiles(node.getPath());

			// collects all paths into allFilePaths
			ipfs.traverseDir(node.getPath(), allFilePaths);
			removeOrphanFiles();

			IPFSDirStat pathStat = ipfs.pathStat(node.getPath());
			if (ok(pathStat)) {
				node.set(NodeProp.IPFS_CID.s(), pathStat.getHash());

				/*
				 * DO NOT DELETE
				 * 
				 * For a "Federated" type of install we will be doing IPNS publish from a browser-only instantiation
				 * of IPFS so the server never has access to any keys, but this would require an 'always-on' up-time
				 * for the IPNS name to stay active I think. However once "IPNSPubSub" is working (or even doing it
				 * ourselves, with plain IPFSPubSub we can potentially broadcast our new CID for any updated IPNS to
				 * all "listening" clients.
				 */
				// Map<String, Object> ipnsMap = ipfs.ipnsPublish(ms, null, pathStat.getHash());
				// String name = (String) ipnsMap.get("Name");
				// if (ok(name )) {
				// node.set(NodeProp.IPNS_CID.s(), name);
				// }
			}

			success = true;
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}

		res.setMessage(buildReport());
		res.setSuccess(success);
	}

	private String buildReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("IPFS Sync complete\n\n");
		sb.append("Total Nodes: " + totalNodes + "\n");
		sb.append("Orphans Deleted: " + orphansRemoved + "\n");
		return sb.toString();
	}

	private void removeOrphanFiles() {
		allFilePaths.forEach(path -> {
			/*
			 * if any file path is not a node path, it needes to be deleted.
			 * 
			 * todo-1: this will run more efficiently if we put path values into a list and then sort that list
			 * ascending by the length of the string, so any parent folders are guaranteed to get deleted before
			 * any of their subfolders (as a convenient consequence of children having to have longer paths than
			 * their parents!) are encountered, and we run therefore the minimal number of deletes required to
			 * accomplish this in every case!
			 */
			if (!allNodePaths.contains(path)) {
				try {
					// to delete the files we really just delete it's parent folder instead, because
					// each node has a decicated folder,
					// and this will delete children first.
					path = XString.stripIfEndsWith(path, "/n.json");
					log.debug("DELETE ORPHAN: " + path);
					ipfs.deletePath(path);
					orphansRemoved++;
				} catch (Exception e) {
					/*
					 * I'm expecting this to fail when it attempts to delete any subfolders under folders that were
					 * already deleted because we may have just deleted their parents already in this same loop so...
					 * 
					 * todo-1: when we delete a folder, scan for all other folders that have that matching prefix and
					 * remove them too, because there's no need to call deleteFile on those.
					 */
				}
			}
		});
	}

	private void processNode(SubNode node) {
		// todo-1: This should be unnecessary but for now we need it.
		snUtil.removeDefaultProps(node);

		snUtil.removeUnwantedPropsForIPFS(node);

		/*
		 * todo-1: this and other places needs to generate canonical JSON (basically just sorted properties
		 * ?) using this??
		 */
		// objectMapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
		// objectMapper.configure(SerializationFeature.INDENT_OUTPUT, true);
		String json = XString.prettyPrint(node);
		String fileName = node.getPath() + "/n.json";
		log.debug("Sync to IPFS: " + fileName);
		allNodePaths.add(fileName);
		totalNodes++;
		addFile(fileName, json);
	}

	/*
	 * todo-1: there *is* a way to eliminate the need for the 'checkExisting' flag and make it always
	 * true but for now the only way to return a CID even if not existing is to attempt to re-add every
	 * time so we do that for now because it's simpler
	 */
	private void addFile(String fileName, String json) {
		if (json.equals(ipfs.readFile(fileName))) {
			log.debug("not writing. Content was up to date.");
			return;
		}
		addFile(fileName, json.getBytes(StandardCharsets.UTF_8));
	}

	private void addFile(String fileName, byte[] bytes) {
		addEntry(fileName, new ByteArrayInputStream(bytes));
	}

	private void addEntry(String fileName, InputStream stream) {
		ipfs.addFileFromStream(session, fileName, stream, null, null);
	}
}