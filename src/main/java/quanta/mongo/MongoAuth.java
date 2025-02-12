package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.net.URL;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.actpub.APConst;
import quanta.actpub.model.APOMention;
import quanta.actpub.model.APOHashtag;
import quanta.actpub.model.APObj;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.NodeAuthFailedException;
import quanta.exception.base.RuntimeEx;
import quanta.instrument.PerfMon;
import quanta.model.AccessControlInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Service for checking authorization for access to nodes. Checks what users are accessing what
 * nodes and checks their privileges againts the ACL on the Nodes.
 */
@Component
public class MongoAuth extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoAuth.class);

	private static final boolean verbose = false;

	private static final Object adminSessionLck = new Object();
	private static MongoSession adminSession;

	private static final Object anonSessionLck = new Object();
	private static MongoSession anonSession;

	private static final ConcurrentHashMap<String, SubNode> userNodesById = new ConcurrentHashMap<>();

	public MongoSession getAdminSession() {
		if (ok(adminSession)) {
			return adminSession;
		}

		synchronized (adminSessionLck) {
			if (no(adminSession)) {
				SubNode root = read.getDbRoot();
				adminSession = new MongoSession(PrincipalName.ADMIN.s(), no(root) ? null : root.getId());
			}
			return adminSession;
		}
	}

	public MongoSession getAnonSession() {
		if (ok(anonSession)) {
			return anonSession;
		}

		synchronized (anonSessionLck) {
			if (no(anonSession)) {
				anonSession = new MongoSession(PrincipalName.ANON.s(), null);
			}
			return anonSession;
		}
	}

	public String getAccountPropById(MongoSession ms, String accountId, String prop) {
		// special case of a public share
		if (PrincipalName.PUBLIC.s().equals(accountId)
				&& (prop.equals(NodeProp.DISPLAY_NAME.s()) || prop.equals(NodeProp.USER.s()))) {
			return PrincipalName.PUBLIC.s();
		}

		String propVal = null;
		SubNode accntNode = null;

		// try to get the node from the cache of nodes
		accntNode = userNodesById.get(accountId);

		// if we found the node get property from it to return.
		if (ok(accntNode)) {
			propVal = accntNode.getStr(prop);
		}
		// else we have to lookup the node from the DB, and then cache it if found
		else {
			accntNode = read.getNode(ms, accountId);
			if (ok(accntNode)) {
				propVal = accntNode.getStr(prop);
				userNodesById.put(accountId, accntNode);
			}
		}

		return propVal;
	}

	/*
	 * Returns a list of all user names that are shared to on this node, including "public" if any are
	 * public.
	 */
	@PerfMon(category = "auth")
	public List<String> getUsersSharedTo(MongoSession ms, SubNode node) {
		List<String> userNames = null;

		List<AccessControlInfo> acList = getAclEntries(ms, node);
		if (ok(acList)) {
			for (AccessControlInfo info : acList) {
				String userNodeId = info.getPrincipalNodeId();
				String name = null;

				if (PrincipalName.PUBLIC.s().equals(userNodeId)) {
					name = PrincipalName.PUBLIC.s();
				} //
				else if (ok(userNodeId)) {
					SubNode accountNode = read.getNode(ms, userNodeId);
					if (ok(accountNode)) {
						name = accountNode.getStr(NodeProp.USER);
					}
				}

				if (ok(name)) {
					// lazy create the list
					if (no(userNames)) {
						userNames = new LinkedList<>();
					}
					userNames.add(name);
				}
			}
		}
		return userNames;
	}

	/*
	 * When a child is created under a parent we want to default the sharing on the child so that
	 * there's an explicit share to the owner of the parent (minus any share to 'child' user that may be
	 * in the parent Acl, because that would represent 'child' node sharing to himself which is never
	 * done)
	 */
	public void setDefaultReplyAcl(SubNode parent, SubNode child) {

		// if parent or child is null or parent is an ACCOUNT node do nothing here.
		if (no(parent) || parent.isType(NodeType.ACCOUNT) || no(child))
			return;

		// log.debug("childNode: " + child.getIdStr() + " being created under " + parent.getIdStr());

		/*
		 * get ACL of the parent (minus the child.owner if he exists there), or else if parent isn't shared
		 * at all we create a new empty ACL.
		 */
		HashMap<String, AccessControl> ac = parent.getAc();
		if (no(ac)) {
			ac = new HashMap<>();
		} else {
			ac = (HashMap<String, AccessControl>) ac.clone();
			ac.remove(child.getOwner().toHexString());
		}

		/*
		 * Special case of replying to (appending under) a FRIEND-type node is always to make this a private
		 * message to the user that friend node represents
		 */
		if (parent.isType(NodeType.FRIEND)) {
			// get user prop from node
			String userName = parent.getStr(NodeProp.USER);

			// if we have a userProp, find the account node for the user
			if (ok(userName)) {
				SubNode accountNode = arun.run(as -> read.getUserNodeByUserName(as, userName));
				if (ok(accountNode)) {
					ac.put(accountNode.getIdStr(), new AccessControl(null, APConst.RDWR));
				}
			}
		}
		/*
		 * otherwise if not a FRIEND node we just share to the owner of the parent node
		 */
		else {
			// add `parent.owner` to the ACL
			ac.put(parent.getOwner().toHexString(), new AccessControl(null, APConst.RDWR));

			/*
			 * We also extract the 'mentions' out of any 'tag' array that might be on this node, so we can
			 * default the content of the post as `@mention1 @mention2 #mention3...` for all the people being
			 * mentioned in the tags array
			 */
			HashMap<String, APObj> tags = auth.parseTags(parent);

			// if no content, and the parent isn't our own node
			if (StringUtils.isEmpty(child.getContent()) && !auth.ownedByThreadUser(parent)) {
				SubNode parentUserNode = arun.run(as -> read.getNode(as, parent.getOwner()));

				if (ok(parentUserNode)) {
					String user = parentUserNode.getStr(NodeProp.USER);
					String url = parentUserNode.getStr(NodeProp.ACT_PUB_ACTOR_ID);
					if (no(url)) {
						url = prop.getProtocolHostAndPort() + APConst.ACTOR_PATH + "/" + user;
					}

					tags.put("@" + user, new APOMention(url, "@" + user));
				}
			}

			if (tags.size() > 0) {
				String content = "";
				for (String key : tags.keySet()) {
					if (key.startsWith("@")) {
						content += key + " ";
					}
				}

				/*
				 * This will put a string of all mentioned users right in the text of the message so they can see
				 * who will be replied to or remove users they don't want replied to.
				 */
				child.setContent(content);
			}
		}
		child.setAc(ac);
	}

	public boolean isAllowedUserName(String userName) {
		userName = userName.trim();
		return !userName.equalsIgnoreCase(PrincipalName.ADMIN.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.PUBLIC.s()) && //
				!userName.equalsIgnoreCase(PrincipalName.ANON.s());
	}

	/*
	 * Adds authorization to any Criteria and returns the updated criteria. Filters to get only nodes
	 * that are publi OR are shared to the current user. For single node lookups we won't need this
	 * because we can do it the old way and be faster, but for queries of multiple records (page
	 * rendering, timeline, search, etc.) we need to build this security right into the query using this
	 * method.
	 */
	public Criteria addSecurityCriteria(MongoSession ms, Criteria crit) {
		// NOTE: If we're the admin we return criteria without adding security.
		if (ms.isAdmin())
			return crit;

		List<Criteria> orCriteria = new LinkedList<>();

		SessionContext sc = ThreadLocals.getSC();
		SubNode myAcntNode = null;

		// note, anonymous users end up keeping myAcntNode null here. anon will nave null rootID here.
		if (ok(sc.getRootId())) {
			myAcntNode = read.getNode(ms, sc.getRootId());
		}

		// node is public
		orCriteria.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));

		// if we have a user add their privileges in addition to public.
		if (ok(myAcntNode)) {
			// or node is shared to us
			orCriteria.add(Criteria.where(SubNode.AC + "." + myAcntNode.getOwner().toHexString()).ne(null));

			// or node is OWNED by us
			orCriteria.add(Criteria.where(SubNode.OWNER).is(myAcntNode.getOwner()));

			// or node was Transferred by us
			orCriteria.add(Criteria.where(SubNode.XFR).is(myAcntNode.getOwner()));
		}

		if (orCriteria.size() > 0) {
			if (no(crit)) {
				crit = new Criteria();
			}
			crit = crit.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));
		}
		return crit;
	}

	public void ownerAuth(SubNode node) {
		ownerAuth(null, node);
	}

	@PerfMon(category = "auth")
	public void ownerAuth(MongoSession ms, SubNode node) {
		if (no(node)) {
			throw new RuntimeEx("Auth Failed. Node did not exist.");
		}
		if (node.adminUpdate)
			return;

		if (no(ms)) {
			ms = ThreadLocals.getMongoSession();
		}

		if (no(ms)) {
			// when we get here it normally means we should've called "arun.exec" to manage
			// the thread instead of justs passing in an 'ms' or null
			throw new RuntimeException("ThreadLocals doesn't have session.");
		}

		if (ms.isAdmin()) {
			return;
		}

		if (no(ms.getUserNodeId())) {
			throw new RuntimeException("session has no userNode: " + XString.prettyPrint(ms));
		}

		if (!ms.getUserNodeId().equals(node.getOwner())) {
			log.error("Unable to save Node (expected ownerId " + ms.getUserNodeId().toHexString() + "): "
					+ XString.prettyPrint(node));
			throw new NodeAuthFailedException();
		}
	}

	public void requireAdmin(MongoSession ms) {
		if (!ms.isAdmin())
			throw new RuntimeEx("auth fail");
	}

	public void authForChildNodeCreate(MongoSession ms, SubNode node) {
		try {
			auth(ms, node, PrivilegeType.WRITE);
		} catch (RuntimeException e) {
			log.debug("session: " + ms.getUserName() + " tried to create a node under nodeId " + node.getIdStr()
					+ " and was refused.");
			throw e;
		}
	}

	@PerfMon(category = "auth")
	public void auth(MongoSession ms, SubNode node, PrivilegeType... privs) {
		// during server init no auth is required.
		if (no(node) || !MongoRepository.fullInit) {
			return;
		}

		// this adminUpdate flag is specifically for the purpose if disabling auth checks
		if (node.adminUpdate)
			return;

		if (verbose)
			log.trace("auth: " + node.getPath());

		if (ms.isAdmin()) {
			if (verbose)
				log.trace("you are admin. auth success.");
			return; // admin can do anything. skip auth
		}

		auth(ms, node, Arrays.asList(privs));
	}

	public boolean ownedByThreadUser(SubNode node) {
		return ok(node) && ok(node.getOwner()) && node.getOwner().toHexString().equals(ThreadLocals.getSC().getRootId());
	}

	/*
	 * The way know a node is an account node is that it is its id matches its' owner. Self owned node.
	 * This is because the very definition of the 'owner' on any given node is the ID of the user's root
	 * node of the user who owns it
	 */
	public boolean isAnAccountNode(MongoSession ms, SubNode node) {
		return node.getIdStr().equals(node.getOwner().toHexString());
	}

	/* Returns true if this user on this session has privType access to 'node' */
	public void auth(MongoSession ms, SubNode node, List<PrivilegeType> priv) {
		// during server init no auth is required.
		if (no(node) || !MongoRepository.fullInit) {
			return;
		}

		// admin has full power over all nodes
		if (ms.isAdmin()) {
			if (verbose)
				log.trace("auth granted. you're admin.");
			return;
		}

		if (verbose)
			log.trace("auth path " + node.getPath() + " for " + ms.getUserName());

		if (no(priv) || priv.size() == 0) {
			throw new RuntimeEx("privileges not specified.");
		}

		if (no(node.getOwner())) {
			throw new RuntimeEx("node had no owner: " + node.getIdStr());
		}

		if (ok(ms.getUserNodeId())) {
			// if this session user is the owner of this node, then they have full power
			if (ms.getUserNodeId().equals(node.getOwner())) {
				if (verbose)
					log.trace("allow: user " + ms.getUserName() + " owns node. accountId: " + node.getOwner().toHexString());
				return;
			}

			if (ms.getUserNodeId().equals(node.getTransferFrom())) {
				if (verbose)
					log.trace("allow: user " + ms.getUserName() + " is transferring node. accountId: "
							+ node.getTransferFrom().toHexString());
				return;
			}
		}

		String sessionUserNodeId = ok(ms.getUserNodeId()) ? ms.getUserNodeId().toHexString() : null;
		// log.debug("nodeAuth userAcctId=" + sessionUserNodeId);
		if (nodeAuth(node, sessionUserNodeId, priv)) {
			if (verbose)
				log.trace("nodeAuth success");
			return;
		}

		// Don't log this. It happens in normal flow cases.
		// log.error("Unauthorized access. NodeId=" + node.getId() + " path=" + node.getPath() + " by user:
		// " + ms.getUserName()
		// + "\n" + ExUtil.getStackTrace(null));

		throw new NodeAuthFailedException();
	}

	/*
	 * NOTE: It is the normal flow that we expect sessionUserNodeId to be null for any anonymous
	 * requests and this is fine because we are basically going to only be pulling 'public' acl to
	 * check, and this is by design.
	 */
	public boolean nodeAuth(SubNode node, String sessionUserNodeId, List<PrivilegeType> privs) {
		// log.debug("nodeAuth on node: " + XString.prettyPrint(node));
		HashMap<String, AccessControl> acl = node.getAc();
		if (no(acl)) {
			// log.debug("no acls.");
			return false;
		}
		String allPrivs = "";

		AccessControl ac = (no(sessionUserNodeId) ? null : acl.get(sessionUserNodeId));
		String privsForUserId = ok(ac) ? ac.getPrvs() : null;
		if (ok(privsForUserId)) {
			allPrivs += privsForUserId;
			// log.debug("Privs for this user: " + privsForUserId);
		}

		/*
		 * We always add on any privileges assigned to the PUBLIC when checking privs for this user, becasue
		 * the auth equivalent is really the union of this set.
		 */
		AccessControl acPublic = acl.get(PrincipalName.PUBLIC.s());
		String privsForPublic = ok(acPublic) ? acPublic.getPrvs() : null;
		if (ok(privsForPublic)) {
			if (allPrivs.length() > 0) {
				allPrivs += ",";
			}
			allPrivs += privsForPublic;
			// log.debug("Public Privs: " + privsForPublic);
		}

		if (allPrivs.length() > 0) {
			for (PrivilegeType priv : privs) {
				// log.debug("Checking for priv: " + priv.name);
				if (allPrivs.indexOf(priv.name) == -1) {
					/* if any priv is missing we fail the auth */
					// log.debug("priv missing. failing auth.");
					return false;
				}
			}
			/* if we looped thru all privs ok, auth is successful */
			return true;
		}
		return false;
	}

	public List<AccessControlInfo> getAclEntries(MongoSession ms, SubNode node) {
		HashMap<String, AccessControl> aclMap = node.getAc();
		if (no(aclMap)) {
			return null;
		}

		/*
		 * I'd like this to not be created unless needed but that pesky lambda below needs a 'final' thing
		 * to work with.
		 */
		List<AccessControlInfo> ret = new LinkedList<>();

		aclMap.forEach((k, v) -> {
			AccessControlInfo acei = createAccessControlInfo(ms, k, v.getPrvs());
			if (ok(acei)) {
				ret.add(acei);
			}
		});
		return ret.size() == 0 ? null : ret;
	}

	public AccessControlInfo createAccessControlInfo(MongoSession ms, String principalId, String authType) {
		String displayName = null;
		String principalName = null;
		String publicKey = null;
		String avatarVer = null;
		String foreignAvatarUrl = null;

		/* If this is a share to public we don't need to lookup a user name */
		if (principalId.equalsIgnoreCase(PrincipalName.PUBLIC.s())) {
			principalName = PrincipalName.PUBLIC.s();
		}
		/* else we need the user name */
		else {
			SubNode principalNode = read.getNode(ms, principalId, false, null);
			if (no(principalNode)) {
				return null;
			}
			principalName = principalNode.getStr(NodeProp.USER);
			displayName = principalNode.getStr(NodeProp.DISPLAY_NAME);
			publicKey = principalNode.getStr(NodeProp.USER_PREF_PUBLIC_KEY);

			// This will be null if it's a local node, and this is fine
			foreignAvatarUrl = principalNode.getStr(NodeProp.ACT_PUB_USER_ICON_URL);

			if (no(foreignAvatarUrl)) {
				Attachment att = principalNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
				avatarVer = ok(att) ? att.getBin() : null;
			}
		}

		AccessControlInfo info =
				new AccessControlInfo(displayName, principalName, principalId, publicKey, avatarVer, foreignAvatarUrl);
		info.addPrivilege(new PrivilegeInfo(authType));
		return info;
	}

	// ========================================================================
	// SubGraphByAclUser (query and count)
	// ========================================================================

	/*
	 * Finds all subnodes that have a share targeting the sharedToAny (account node IDs of a person
	 * being shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public'
	 * in sharedTo instead
	 */
	public Iterable<SubNode> searchSubGraphByAclUser(MongoSession ms, String pathToSearch, List<String> sharedToAny, Sort sort,
			int limit, ObjectId ownerIdMatch) {

		Query q = subGraphByAclUser_query(ms, pathToSearch, sharedToAny, ownerIdMatch);
		if (no(q))
			return null;

		if (ok(sort)) {
			q.with(sort);
		}

		q.limit(limit);
		return mongoUtil.find(q);
	}

	/*
	 * counts all subnodes that have a share targeting the sharedTo (account node ID of a person being
	 * shared with), regardless of the type of share 'rd,rw'. To find public shares pass 'public' in
	 * sharedTo instead
	 */
	public long countSubGraphByAclUser(MongoSession ms, String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
		Query q = subGraphByAclUser_query(ms, pathToSearch, sharedToAny, ownerIdMatch);
		if (no(q))
			return 0L;
		Long ret = ops.count(q, SubNode.class);
		return ret;
	}

	private Query subGraphByAclUser_query(MongoSession ms, String pathToSearch, List<String> sharedToAny, ObjectId ownerIdMatch) {
		// this will be node.getPath() to search under the node, or null for searching
		// under all user content.
		if (no(pathToSearch)) {
			pathToSearch = NodePath.USERS_PATH;
		}

		Query q = new Query();
		Criteria crit = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch));

		if (ok(sharedToAny) && sharedToAny.size() > 0) {
			List<Criteria> orCriteria = new LinkedList<>();
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.AC + "." + share).ne(null));
			}

			crit = crit.andOperator(new Criteria().orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()])));
		}

		if (ok(ownerIdMatch)) {
			crit = crit.and(SubNode.OWNER).is(ownerIdMatch);
		}

		q.addCriteria(crit);
		return q;
	}

	// ========================================================================
	// SubGraphByAcl (query and count)
	// ========================================================================

	/*
	 * Finds nodes that have any sharing on them at all. This query is secure and can't leak any
	 * incorrect nodes to wrong users because ownerIdMatch forces only the owner running the query to
	 * see their own nodes only
	 */
	public Iterable<SubNode> searchSubGraphByAcl(MongoSession ms, int skip, String pathToSearch, ObjectId ownerIdMatch, Sort sort,
			int limit) {
		Query q = subGraphByAcl_query(ms, pathToSearch, ownerIdMatch);

		if (ok(sort)) {
			q.with(sort);
		}

		if (skip > 0) {
			q.skip(skip);
		}

		q.limit(limit);
		return mongoUtil.find(q);
	}

	/* Finds nodes that have any sharing on them at all */
	public long countSubGraphByAcl(MongoSession ms, String pathToSearch, ObjectId ownerIdMatch) {
		Query q = subGraphByAcl_query(ms, pathToSearch, ownerIdMatch);
		return ops.count(q, SubNode.class);
	}

	public Query subGraphByAcl_query(MongoSession ms, String pathToSearch, ObjectId ownerIdMatch) {
		Query q = new Query();

		if (no(pathToSearch)) {
			pathToSearch = NodePath.USERS_PATH;
		}

		/*
		 * This regex finds all that START WITH path, have some characters after path, before the end of the
		 * string. Without the trailing (.+)$ we would be including the node itself in addition to all its
		 * children.
		 */
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(pathToSearch)) //
				.and(SubNode.AC).ne(null);

		if (ok(ownerIdMatch)) {
			criteria = criteria.and(SubNode.OWNER).is(ownerIdMatch);
		}

		q.addCriteria(criteria);
		return q;
	}

	/*
	 * Returns map of of APOHashtag and/or APOMention objects, where the keys are the hashtag or mention
	 * including the # or @ as first char of the key.
	 */
	public HashMap<String, APObj> parseTags(String content, boolean parseMentions, boolean parseHashtags) {
		HashMap<String, APObj> tags = new HashMap<>();
		if (no(content))
			return tags;

		StringTokenizer t = new StringTokenizer(content, APConst.TAGS_TOKENIZER, false);

		while (t.hasMoreTokens()) {
			String tok = t.nextToken();

			if (tok.length() > 1) {
				// Mention (@name@server.com or @name)
				int atMatches = StringUtils.countMatches(tok, "@");
				if (parseMentions && tok.startsWith("@") && atMatches <= 2) {
					String actor = null;

					String userName = tok;
					boolean isLocalUserName = userName.endsWith("@" + prop.getMetaHost().toLowerCase());
					if (isLocalUserName) {
						userName = XString.stripIfStartsWith(userName, "@");
						userName = apUtil.stripHostFromUserName(userName);
						actor = apUtil.makeActorUrlForUserName(userName);
					}
					// foreign userName
					else if (atMatches == 2) {
						String userDoingAction = ThreadLocals.getSC().getUserName();
						actor = apUtil.getActorUrlFromForeignUserName(userDoingAction, tok);
					}
					tags.put(tok, new APOMention(actor, tok));
				}
				// Hashtag
				else if (parseHashtags && tok.startsWith("#") && StringUtils.countMatches(tok, "#") == 1) {
					String shortTok = XString.stripIfStartsWith(tok, "#");
					tags.put(tok, new APOHashtag(prop.getProtocolHostAndPort() + "?view=feed&tagSearch=" + shortTok, tok));
				}
			}
		}

		return tags;
	}

	/**
	 * Parses Mentions+Hashtags from ACT_PUB_TAG property of the node.
	 */
	public HashMap<String, APObj> parseTags(SubNode node) {
		HashMap<String, APObj> tagSet = new HashMap<>();
		if (no(node))
			return tagSet;

		List<Object> tags = node.getObj(NodeProp.ACT_PUB_TAG.s(), List.class);
		if (ok(tags)) {
			for (Object tag : tags) {
				try {
					if (tag instanceof Map) {
						Map<?, ?> m = (Map) tag;
						Object type = m.get("type");
						Object href = m.get("href");
						Object name = m.get("name");

						// ActPub spec originally didn't have Hashtag here, so default to that if no type
						if (no(type)) {
							type = "Hashtag";
						}

						// skip if not all strings
						if (!(type instanceof String) || !(href instanceof String) || !(name instanceof String)) {
							continue;
						}

						String typeStr = (String) type;

						if (typeStr.equalsIgnoreCase("Hashtag")) {
							tagSet.put((String) name, new APOHashtag((String) href, (String) name));
						}
						// Process Mention
						else if (typeStr.equalsIgnoreCase("Mention")) {

							APOMention tagObj = new APOMention((String) href, (String) name);

							// add a string like host@username
							URL hrefUrl = new URL((String) href);

							// sometimes the name is ALREADY containing the host, so be sure not to append it again in that case
							// or else we end up with "user@server.com@server.com"
							String longName = (String) name;

							// if 'longName' is like "@user" with no domain, then add the domain.
							if (StringUtils.countMatches(longName, "@") < 2) {
								longName += "@" + hrefUrl.getHost();
							}

							// I'm just adding this as a sanity check but it should be unnecessary
							if (!longName.startsWith("@")) {
								longName = "@" + longName;
							}

							// one more sanity check to be sure everything is ok with the name
							if (StringUtils.countMatches(longName, "@") > 2) {
								continue;
							}

							// build this name without host part if it's a local user, otherwise full fediverse name
							String user = prop.getMetaHost().equals(hrefUrl.getHost()) ? (String) name : longName;

							// add the name if it's not the current user. No need to self-mention in a reply?
							if (!user.equals("@" + apUtil.fullFediNameOfThreadUser())) {
								tagSet.put(user, tagObj);
							}
						}
					} else {
						log.debug("Failed to parse tag on nodeId " + node.getIdStr() + " because it was type="
								+ tag.getClass().getName());
					}
				} catch (Exception e) {
					log.error("Unable to process tag.", e);
					// ignore errors on any tag and continue to next tag
				}
			}
		}
		return tagSet;
	}

	/*
	 * Parses all mentions (like '@bob@server.com', or '@bob' for local user) in the node content text
	 * and adds them (if not existing) to the node sharing on the node, which ensures the person
	 * mentioned has visibility of this node and that it will also appear in their FEED.
	 */
	public void saveMentionsToACL(HashMap<String, APObj> tags, MongoSession ms, SubNode node) {
		if (no(tags)) {
			return;
		}
		boolean acChanged = false;
		HashMap<String, AccessControl> ac = node.getAc();

		// make sure all parsed toUserNamesSet user names are saved into the node acl */
		for (String userName : tags.keySet()) {
			APObj val = tags.get(userName);

			// ignore of this is something else like a Hashtag
			if (!(val instanceof APOMention))
				continue;

			userName = XString.stripIfStartsWith(userName, "@");
			SubNode acctNode = read.getUserNodeByUserName(ms, userName);

			/*
			 * If this is a foreign 'mention' user name that is not imported into our system, we auto-import
			 * that user now
			 */
			if (StringUtils.countMatches(userName, "@") == 1) {
				/*
				 * todo-2: WARNING: this sets off a chain reaction of fediverse crawling!! Unless/until you invent
				 * some way to stop that (or decide you WANT a FediCrawler) then keep this commented out. Don't
				 * delete this code until you think this thru more.
				 */
				// if (no(acctNode)) {
				// acctNode = actPub.loadForeignUserByUserName(session, userName);
				// }
				apub.userEncountered(userName, false);
			}

			if (ok(acctNode)) {
				String acctNodeId = acctNode.getIdStr();
				if (no(ac) || !ac.containsKey(acctNodeId)) {
					/*
					 * Lazy create 'ac' so that the net result of this method is never to assign non null when it could
					 * be left null
					 */
					if (no(ac)) {
						ac = new HashMap<String, AccessControl>();
					}
					acChanged = true;
					ac.put(acctNodeId, new AccessControl(null, APConst.RDWR));
				}
			} else {
				log.debug("Mentioned user not found: " + userName);
			}
		}

		if (acChanged) {
			node.setAc(ac);

			// for now this saving is being done at a higher layer up (method that calls this one), and is
			// always run.
			// update.save(ms, node);
		}
	}
}
