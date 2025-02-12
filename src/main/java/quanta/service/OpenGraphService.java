package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import org.apache.commons.collections4.map.LRUMap;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.OpenGraph;
import quanta.request.GetOpenGraphRequest;
import quanta.response.GetOpenGraphResponse;

@Component
public class OpenGraphService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(OpenGraphService.class);

	public final LRUMap<String, OpenGraph> ogCache = new LRUMap(1000);

	public static final String BROWSER_USER_AGENT =
			"Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36";

	public GetOpenGraphResponse getOpenGraph(GetOpenGraphRequest ogReq) {
		GetOpenGraphResponse res = new GetOpenGraphResponse();
		OpenGraph openGraph = null;

		// if the url is cached (even if null) then return whatever's in the cache
		synchronized (ogCache) {
			if (ogCache.containsKey(ogReq.getUrl())) {
				openGraph = ogCache.get(ogReq.getUrl());
				res.setOpenGraph(openGraph);
				return res;
			}
		}

		try {
			openGraph = parseOpenGraph(ogReq.getUrl());
		} catch (Exception e) {
			// ignore this error, for now (todo-2)
			// ExUtil.error(log, "failed parsing OpenGraph", e);
		}
		
		// we allow storing a null if we got back a null. Cache it so we don't try again.
		synchronized (ogCache) {
			ogCache.put(ogReq.getUrl(), openGraph);
		}

		res.setOpenGraph(openGraph);
		return res;
	}

	public OpenGraph parseOpenGraph(String urlStr) throws Exception {
		// log.debug("JSoup parsing Images from URL: " + urlStr);
		OpenGraph openGraph = new OpenGraph();
		Connection con = Jsoup.connect(urlStr);

		/*
		 * this browseragent thing is important to trick servers into sending us the LARGEST versions of the
		 * images
		 */
		con.userAgent(BROWSER_USER_AGENT);
		Document doc = con.get();

		// todo-2: add site_name, type, url, twitter:url, twitter:card (like og:type)

		openGraph.setTitle(getOg(doc, "og:title"));
		if (no(openGraph.getTitle())) {
			openGraph.setTitle(getOg(doc, "twitter:title"));
		}

		openGraph.setUrl(getOg(doc, "og:url"));
		if (no(openGraph.getUrl())) {
			openGraph.setUrl(getOg(doc, "twitter:url"));
		}

		openGraph.setDescription(getOg(doc, "og:description"));
		if (no(openGraph.getDescription())) {
			openGraph.setDescription(getOg(doc, "twitter:description"));
		}

		openGraph.setImage(getOg(doc, "og:image"));
		if (no(openGraph.getImage())) {
			openGraph.setImage(getOg(doc, "twitter:image"));
		}
		return openGraph;
	}

	private String getOg(Document doc, String prop) {
		Elements elm = doc.select("meta[property=" + prop + "]");
		return ok(elm) ? elm.attr("content") : null;
	}
}
