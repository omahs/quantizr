package quanta.service;

import java.io.InputStream;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import quanta.config.SessionContext;
import quanta.config.SpringContextUtil;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.model.SubNode;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import static quanta.util.Util.*;

/**
 * Import from ZIP files. Imports zip files that have the same type of directory structure and
 * content as the zip files that are exported from SubNode. The zip file doesn't of course have to
 * have been actually exported from SubNode in order to import it, but merely have the proper
 * layout/content.
 */
@Lazy @Component
@Scope("prototype")
public class ImportZipService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoUpdate update;

	@Autowired
	@Lazy
	protected MongoRead read;

	private ZipArchiveInputStream zis;

	/*
	 * imports the file directly from an internal resource file (classpath resource, built into WAR file
	 * itself)
	 */
	public SubNode inportFromResource(MongoSession ms, String resourceName, SubNode node, String nodeName) {

		Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
		InputStream is = null;
		SubNode rootNode = null;
		try {
			is = resource.getInputStream();
			rootNode = importFromStream(ms, is, node, true);
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		} finally {
			StreamUtil.close(is);
		}

		log.debug("Finished Input From Zip file.");
		update.saveSession(ms);
		return rootNode;
	}

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(MongoSession ms, InputStream inputStream, SubNode node, boolean isNonRequestThread) {
		SessionContext sc = ThreadLocals.getSC();
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), sc.getUserName());
		if (no(userNode)) {
			throw new RuntimeEx("UserNode not found: " + sc.getUserName());
		}

		LimitedInputStreamEx is = null;
		try {
			targetPath = node.getPath();
			this.session = ms;

			// todo-1: replace with the true amount of storage this user has remaining. Admin is unlimited.
			int maxSize = sc.isAdmin() ? Integer.MAX_VALUE : Const.DEFAULT_USER_QUOTA;
			is = new LimitedInputStreamEx(inputStream, maxSize);
			zis = new ZipArchiveInputStream(is);

			ZipArchiveEntry entry;
			while (ok(entry = zis.getNextZipEntry())) {
				if (!entry.isDirectory()) {
					processFile(entry, zis, userNode.getOwner());
				}
			}

		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(is);
		}
		return importRootNode;
	}
}