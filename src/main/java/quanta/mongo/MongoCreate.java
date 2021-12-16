package quanta.mongo;

import java.util.List;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import quanta.model.PropertyInfo;
import quanta.model.client.NodeType;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.SubNode;

import static quanta.util.Util.*;

/**
 * Performs the 'create' (as in CRUD) operations for creating new nodes in MongoDB
 */
@Lazy @Component
public class MongoCreate  {
	private static final Logger log = LoggerFactory.getLogger(MongoCreate.class);

	@Autowired
	@Lazy
	protected AdminRun arun;

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoUpdate update;

	@Autowired
	@Lazy
	protected MongoRead read;

	public SubNode createNode(MongoSession ms, SubNode parent, String type, Long ordinal, CreateNodeLocation location,
			boolean updateParentOrdinals) {
		return createNode(ms, parent, null, type, ordinal, location, null, null, updateParentOrdinals);
	}

	public SubNode createNode(MongoSession ms, String path) {
		SubNode node = new SubNode(ms.getUserNodeId(), path, NodeType.NONE.s(), null);
		return node;
	}

	public SubNode createNode(MongoSession ms, String path, String type) {
		if (no(type)) {
			type = NodeType.NONE.s();
		}
		SubNode node = new SubNode(ms.getUserNodeId(), path, type, null);
		return node;
	}

	public SubNode createNodeAsOwner(MongoSession ms, String path, String type, ObjectId ownerId) {
		if (no(type)) {
			type = NodeType.NONE.s();
		}
		// ObjectId ownerId = read.getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, type, null);
		return node;
	}

	/*
	 * Creates a node, but does NOT persist it. If parent==null it assumes it's adding a root node. This
	 * is required, because all the nodes at the root level have no parent. That is, there is no ROOT
	 * node. Only nodes considered to be on the root.
	 * 
	 * relPath can be null if no path is known
	 */
	public SubNode createNode(MongoSession ms, SubNode parent, String relPath, String type, Long ordinal,
			CreateNodeLocation location, List<PropertyInfo> properties, ObjectId ownerId, boolean updateParentOrdinals) {
		if (no(relPath)) {
			/*
			 * Adding a node ending in '?' will trigger for the system to generate a leaf node automatically.
			 */
			relPath = "?";
		}

		if (no(type)) {
			type = NodeType.NONE.s();
		}

		String path = (no(parent) ? "" : parent.getPath()) + "/" + relPath;

		if (no(ownerId)) {
			ownerId = ms.getUserNodeId();
		}

		// for now not worried about ordinals for root nodes.
		if (no(parent)) {
			ordinal = 0L;
		} else {
			if (updateParentOrdinals) {
				if (no(ordinal)) {
					ordinal = 0L;
				}

				Long _ordinal = ordinal;
				// this updates the parent so we run as admin.
				ordinal = (Long) arun.run(as -> {
					return prepOrdinalForLocation(as, location, parent, _ordinal);
				});
			}
		}

		SubNode node = new SubNode(ownerId, path, type, ordinal);

		if (ok(properties)) {
			for (PropertyInfo propInfo : properties) {
				node.set(propInfo.getName(), propInfo.getValue());
			}
		}

		return node;
	}

	private Long prepOrdinalForLocation(MongoSession ms, CreateNodeLocation location, SubNode parent, Long ordinal) {
		switch (location) {
			case FIRST:
				ordinal = 0L;
				insertOrdinal(ms, parent, 0L, 1L);
				break;
			case LAST:
				ordinal = read.getMaxChildOrdinal(ms, parent) + 1;
				break;
			case ORDINAL:
				insertOrdinal(ms, parent, ordinal, 1L);
				break;
			default:
				throw new RuntimeException("Unknown ordinal");
		}

		update.saveSession(ms);
		return ordinal;
	}

	/*
	 * Shifts all child ordinals down (increments them by rangeSize), that are >= 'ordinal' to make a
	 * slot for the new ordinal positions for some new nodes to be inserted into this newly available
	 * range of unused sequential ordinal values (range of 'ordinal+1' thru 'ordinal+1+rangeSize')
	 */
	public void insertOrdinal(MongoSession ms, SubNode node, long ordinal, long rangeSize) {
		long maxOrdinal = ordinal + rangeSize;

		auth.auth(ms, node, PrivilegeType.READ);

		// save all if there's any to save.
		update.saveSession(ms);

		Criteria criteria = Criteria.where(SubNode.ORDINAL).gte(ordinal);
		for (SubNode child : read.getChildrenUnderPath(ms, node.getPath(), Sort.by(Sort.Direction.ASC, SubNode.ORDINAL),
				null, 0, null, criteria)) {
			child.setOrdinal(maxOrdinal++);
		}
	}
}