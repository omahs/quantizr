package quanta.test;

import java.util.Calendar;
import com.mongodb.client.result.DeleteResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.mongo.MongoUpdate;
import quanta.mongo.model.FediverseName;

@Lazy @Component("MongoFediverseNamesTest")
public class MongoFediverseNamesTest implements TestIntf {
	private static final Logger log = LoggerFactory.getLogger(MongoFediverseNamesTest.class);

	@Autowired
	@Lazy
	private MongoUpdate update;

	@Autowired
	@Lazy
	private MongoTemplate ops;

	@Override
	public void test() throws Exception {
		log.debug("*****************************************************************************************");
		log.debug("MongoFediverseNamesTest Running!");

		removeAll();

		ops.indexOps(FediverseName.class).ensureIndex(new Index().on(FediverseName.FIELD_NAME, Direction.ASC).unique());

		String name = "jameson2@server.com";
		FediverseName fName = new FediverseName();
		fName.setName(name);
		fName.setCreateTime(Calendar.getInstance().getTime());
		ops.save(fName);
		log.debug("Saved: " + name);

		try {
			fName = new FediverseName();
			fName.setName(name);
			update.saveObj(fName);
			throw new RuntimeException("Allowed non duplicate name: " + name);
		} catch (Exception e) {
			log.debug("Successfully rejected duplicate with: " + e.getClass().getName());
		}

		dump();

		log.debug("MongoFediverseNamesTest Ok.");
		log.debug("*****************************************************************************************");
	}

	private void dump() {
		log.debug("Dumping all FediverseNames...");
		Iterable<FediverseName> recs = ops.findAll(FediverseName.class);
		for (FediverseName fName : recs) {
			log.debug(fName.getName());
		}
	}

	private void removeAll() {
		Query query = new Query();
		query.addCriteria(Criteria.where(FediverseName.FIELD_NAME).ne(null));

		DeleteResult res = ops.remove(query, FediverseName.class);
		log.debug("Objects deleted: " + res.getDeletedCount());
	}
}
