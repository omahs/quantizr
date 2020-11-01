package org.subnode.response;

import org.subnode.model.GraphNode;
import org.subnode.response.base.ResponseBase;

public class GraphResponse extends ResponseBase {
	private GraphNode rootNode;

	public GraphNode getRootNode() {
		return rootNode;
	}

	public void setRootNode(GraphNode rootNode) {
		this.rootNode = rootNode;
	}
}

