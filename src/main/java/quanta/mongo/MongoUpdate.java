package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.instrument.PerfMon;
import quanta.model.UserStats;
import quanta.model.client.Attachment;
import quanta.mongo.model.SubNode;
import quanta.util.Cast;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.Val;
import quanta.util.XString;

/**
 * Performs update (as in CRUD) operations for MongoDB
 */
@Component
public class MongoUpdate extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoUpdate.class);

	// NOTE: Since this is a threadlocal we have no concurrency protection (not needed)
	private static final ThreadLocal<Boolean> saving = new ThreadLocal<>();

	public void saveObj(Object obj) {
		ops.save(obj);
	}

	public void saveIfDirty(MongoSession ms, SubNode node) {
		if (no(node) || !ThreadLocals.hasDirtyNode(node.getId())) return;
		save(ms, node, true);
	}

	public void save(MongoSession ms, SubNode node) {
		save(ms, node, true);
	}

	public void setParentHasChildren(SubNode node) {
		if (no(node)) return;
		arun.run(as -> {
			SubNode parent = read.findNodeByPath(node.getParentPath());
			if (ok(parent)) {
				parent.setHasChildren(true);
			}
			return null;
		});
	}

	@PerfMon(category = "update")
	public void save(MongoSession ms, SubNode node, boolean allowAuth) {
		if (allowAuth) {
			auth.ownerAuth(ms, node);
		}
		// log.debug("MongoApi.save: DATA: " + XString.prettyPrint(node));

		// if not doing allowAuth, we need to be sure the thread has admin session
		// because the MongoEventListener looks in threadlocals for auth
		if (!allowAuth) {
			arun.run(as -> {
				ops.save(node);
				return null;
			});
		}
		// otherwise leave same/current threadlocals as is and MongoEventListener will auth based on this
		// thread.
		else {
			ops.save(node);
		}
		ThreadLocals.clean(node);
	}

	public void saveSession(MongoSession ms) {
		update.saveSession(ms, false);
	}

	private boolean isSaving() {
		return ok(saving.get()) && saving.get().booleanValue();
	}

	@PerfMon(category = "update")
	public void saveSession(MongoSession ms, boolean asAdmin) {
		if (no(ms) || isSaving() || !ThreadLocals.hasDirtyNodes())
			return;

		try {
			// we check the saving flag to ensure we don't go into circular recursion here.
			saving.set(true);

			synchronized (ms) {
				ThreadLocals.getDirtyNodes().forEach((key, value) -> {
					if (!key.toHexString().equals(value.getIdStr())) {
						throw new RuntimeException(
								"Node originally cached as ID " + key.toHexString() + " now has key" + value.getIdStr());
					}
				});

				/*
				 * We use 'nodes' list to avoid a concurrent modification exception, because calling 'save()' on a
				 * node will have the side effect of removing it from dirtyNodes, and that can't happen during the
				 * loop below because we're iterating over dirtyNodes.
				 */
				List<SubNode> nodes = new LinkedList<>();

				/*
				 * check that we are allowed to write all, before we start writing any
				 */
				for (SubNode node : ThreadLocals.getDirtyNodes().values()) {
					try {
						auth.ownerAuth(ms, node);
					} catch (Exception e) {
						log.debug("Dirty node save attempt failed: " + XString.prettyPrint(node)
								+ "\bYour mongoSession has user: " + ms.getUserName() + //
								" and your ThreadLocal session is: " + ThreadLocals.getSC().getUserName());
					}

					nodes.add(node);
				}

				for (SubNode node : nodes) {
					// log.debug("Saving Dirty nodeId=" + (node.getId()==null ? "null (new node?)" : node.getIdStr()));
					update.save(ms, node, false);
				}

				/*
				 * This theoretically should never find any dirty nodes, because we just saved them all but we
				 * definitely still want this line of code here
				 */
				ThreadLocals.clearDirtyNodes();
			}
		} //
		catch (Exception e) {
			// don't rethrow any exceptions from in here.
			ExUtil.error(log, "exception in call processor", e);
		} //
		finally {
			saving.set(false);
		}
	}

	/*
	 * Unpins any IPFS data that is not currently referenced by MongoDb. Cleans up orphans.
	 */
	public String releaseOrphanIPFSPins(HashMap<ObjectId, UserStats> statsMap) {
		Val<String> ret = new Val<>("failed");

		// run as admin
		arun.run(as -> {
			int pinCount = 0, orphanCount = 0;
			LinkedHashMap<String, Object> pins = Cast.toLinkedHashMap(ipfsPin.getPins());
			if (ok(pins)) {
				/*
				 * For each CID that is pinned we do a lookup to see if there's a Node that is using that PIN, and
				 * if not we remove the pin
				 */
				for (String pin : pins.keySet()) {
					log.debug("Check PIN: " + pin);
					boolean attachment = false;

					SubNode ipfsNode = read.findByIPFSPinned(as, pin);
					Attachment att = ipfsNode.getFirstAttachment();

					// if there was no IPFS_LINK using this pin, then check to see if any node has the SubNode.CID
					if (no(ipfsNode)) {
						// turns out MFS stuff will never be Garbage Collected, no matter what, so we don't need
						// to pin it ever, so for now I'm leaving this code here, but we don't need it, and the CIDs that
						// are
						// 'backing' the MFS file storage don't even appear in the pinning system.
						// ipfsNode = read.findByCID(as, pin);
					} else {
						attachment = true;
					}

					if (ok(ipfsNode)) {
						pinCount++;
						log.debug("Found CID" + (attachment ? "(att)" : "") + " nodeId=" + ipfsNode.getIdStr());

						if (attachment && ok(statsMap)) {
							Long binSize = ok(att) ? att.getSize() : null;
							if (no(binSize)) {
								// Note: If binTotal is ever zero here we SHOULD do what's in the comment above
								// an call objectStat to put correct amount in.
								binSize = 0L;
							}

							/*
							 * Make sure storage space for this IPFS node pin is built into user quota. NOTE: We could be more
							 * aggressive about 'correctness' here and actually call ipfs.objectStat on each CID, to get a more
							 * bullet proof total bytes amount, but we are safe enough trusting what the node info holds,
							 * becasue it should be correct.
							 */
							UserStats stats = statsMap.get(ipfsNode.getOwner());
							if (no(stats)) {
								stats = new UserStats();
								stats.binUsage = binSize;
								statsMap.put(ipfsNode.getOwner(), stats);
							} else {
								stats.binUsage = stats.binUsage.longValue() + binSize;
							}
						}
					} else {
						// log.debug("Removing Orphan IPFS CID=" + pin);
						orphanCount++;
						ipfsPin.remove(pin);
					}
				}
			}
			ret.setVal("Pins in use: " + pinCount + "\nOrphan Pins removed: " + orphanCount + "\n");
			log.debug(ret.getVal());
			return null;
		});
		return ret.getVal();
	}

	public void runRepairs() {
		Query query = new Query();
		Update update = new Update();
		update.set(SubNode.HAS_CHILDREN, null);
		ops.findAndModify(query, update, SubNode.class);
	}

	// returns a new BulkOps if one not yet existing
	public BulkOperations bulkOpSetPropVal(BulkOperations bops, ObjectId id, String prop, Object val) {
		if (no(bops)) {
			bops = ops.bulkOps(BulkMode.UNORDERED, SubNode.class);
		}
		Query query = new Query().addCriteria(new Criteria("id").is(id));
		Update update = new Update().set(prop, val);
		bops.updateOne(query, update);
		return bops;
	}
}
