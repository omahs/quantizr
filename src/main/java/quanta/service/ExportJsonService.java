package quanta.service;

import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.config.AppProp;
import quanta.config.SpringContextUtil;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.FileUtils;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.Val;
import static quanta.util.Util.*;

/**
 * Import/Export of Raw JSON and Binaries to and from filesystem/classpath)
 */
@Lazy @Component
@Scope("prototype")
public class ExportJsonService  {
	private static final Logger log = LoggerFactory.getLogger(ExportJsonService.class);

	@Autowired
	@Lazy
	protected AttachmentService attach;

	@Autowired
	@Lazy
	protected AppProp prop;

	@Autowired
	@Lazy
	protected UserManagerService user;

	@Autowired
	@Lazy
	protected MongoUtil mongoUtil;

	@Autowired
	@Lazy
	protected MongoUpdate update;

	/* This object is Threadsafe so this is the correct usage 'static final' */
	private static final ObjectMapper objectMapper = new ObjectMapper();
	static {
		objectMapper.setSerializationInclusion(Include.NON_NULL);
	}
	private static final ObjectWriter jsonWriter = objectMapper.writerWithDefaultPrettyPrinter();

	/*
	 * todo-2: need capability to handle binary files also, but before implementing that look for any
	 * export options on the grid api itself.
	 * 
	 * Dumps all nodes that have property "pth" starting with 'pathPrefix', or all nodes if pathPrefix
	 * is null.
	 */
	public String dumpAllNodes(MongoSession ms, String pathPrefix, String fileName) {
		try {
			if (!FileUtils.dirExists(prop.getAdminDataFolder())) {
				throw ExUtil.wrapEx("adminDataFolder does not exist");
			}

			String targetFolder = prop.getAdminDataFolder() + File.separator + fileName;
			FileUtils.createDirectory(targetFolder);

			/* This is not a typo, this path will be like ".../fileName/fileName.json" */
			String fullFileName = targetFolder + File.separator + fileName + ".json";

			Val<Integer> numDocs = new Val<>(0);
			Val<Integer> numBins = new Val<>(0);

			byte[] newLine = "\n,\n".getBytes(StandardCharsets.UTF_8);

			Query query = new Query();
			Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathPrefix));
			query.addCriteria(criteria);

			Iterable<SubNode> iter = mongoUtil.find(query);

			BufferedOutputStream os = null;
			try {
				os = new BufferedOutputStream(new FileOutputStream(fullFileName));
				BufferedOutputStream _os = os;
				iter.forEach((node) -> {
					String binFileName = node.getStr(NodeProp.BIN_FILENAME.s());
					if (ok(binFileName)) {
						if (saveBinaryToFileSystem(binFileName, targetFolder, node)) {
							numBins.setVal(numBins.getVal() + 1);
						}
					} else {
						String path = node.getPath();
						log.debug("Node has no binary: " + path);
					}

					try {
						String json = jsonWriter.writeValueAsString(node);
						_os.write(json.getBytes(StandardCharsets.UTF_8));
						_os.write(newLine);
						numDocs.setVal(numDocs.getVal() + 1);
					} catch (Exception e) {
						// todo-2
						e.printStackTrace();
					}
				});
				os.flush();
			} catch (Exception ex) {
				throw ExUtil.wrapEx(ex);
			} finally {
				StreamUtil.close(os);
			}

			return "NodeCount: " + numDocs.getVal() + " exported to " + fileName + ". BinaryCount=" + numBins.getVal() + "<p>";
		} catch (Exception e) {
			return "Failed exporting " + fileName;
		}
	}

	private boolean readBinaryFromResource(MongoSession ms, SubNode node, String binFileName, String subFolder) {
		boolean ret = false;

		String binMime = node.getStr(NodeProp.BIN_MIME.s());
		ObjectId oid = node.getId();
		if (ok(oid)) {

			InputStream is = null;
			LimitedInputStreamEx lis = null;
			try {
				String resourceName = "classpath:/nodes/" + subFolder + "/" + oid.toHexString() + "-" + binFileName;
				Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
				is = resource.getInputStream();
				lis = new LimitedInputStreamEx(is, user.getMaxUploadSize(ms));
				attach.writeStream(ms, "", node, lis, binFileName, binMime, null);
				update.save(ms, node);

			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				StreamUtil.close(lis);
			}
		} else {
			log.debug("unable to get oid");
		}
		return ret;
	}

	private boolean saveBinaryToFileSystem(String binFileName, String targetFolder, SubNode node) {
		boolean ret = false;
		if (ok(binFileName)) {
			log.debug("FileName: " + binFileName);
		}

		InputStream is = attach.getStreamByNode(node, "");
		if (ok(is)) {
			try {
				String targetFileName = targetFolder + File.separator + node.getIdStr() + "-" + binFileName;
				File targetFile = new File(targetFileName);
				/* warning: we have our own FileUtils (conflict of name) */
				org.apache.commons.io.FileUtils.copyInputStreamToFile(is, targetFile);
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				StreamUtil.close(is);
			}

			ret = true;
		} else {
			log.debug("Unable to get inputstream or oid.");
		}

		return ret;
	}

	/*
	 * Imports the data from /src/main/resources/nodes/[subFolder] into the db, which will update the
	 * targetPath node path (like "/r/public"), content on the tree.
	 * 
	 * NOTE: This code no longer being used, but I want to keep for future reference if we ever need to
	 * import JSON into the DB again in some automated way.
	 */
	public String resetNode(MongoSession ms, String subFolder) {
		try {
			ThreadLocals.setParentCheckEnabled(false);

			String resourceName = "classpath:/nodes/" + subFolder + "/" + subFolder + ".json";
			Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));

			try {
				String line;
				StringBuilder buf = new StringBuilder();

				while (ok(line = in.readLine())) {
					if (!line.equals(",")) {
						buf.append(line);
						buf.append("\n"); // not needed right?
						continue;
					}
					String json = buf.toString();
					buf.setLength(0);

					// log.debug("JSON: " + json);

					// jsonToNodeService.importJsonContent(json, node);
					SubNode node = objectMapper.readValue(json, SubNode.class);
					update.save(ms, node);

					String binFileName = node.getStr(NodeProp.BIN_FILENAME.s());
					if (ok(binFileName)) {
						attach.deleteBinary(ms, "", node, null);
						readBinaryFromResource(ms, node, binFileName, subFolder);
					}
				}
			} finally {
				ThreadLocals.setParentCheckEnabled(true);
				StreamUtil.close(in);
			}
			log.debug("import successful.");
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return "success!";
	}
}