package quanta.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import quanta.request.base.RequestBase;

public class RenderNodeRequest extends RequestBase {

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	/*
	 * offset for render of a child node which works like OFFSET on RDBMS. It's the
	 * point at which we start gathering nodes to return (or the number to skip
	 * over), use for pagination support. In other words, offset is the index of the
	 * first child to render in the results.
	 */
	private int offset;

	/**
	 * If this is 0, it has no effect. If it's 1 that means try to jump to the next
	 * sibling of the current page root node, and if -1 then it tries to go to
	 * previous sibling.
	 */
	private int siblingOffset;

	private boolean upLevel;
	private boolean renderParentIfLeaf;
	private boolean forceRenderParent;

	// specifies how many levels ABOVE the requested node to get. To load parentNodes property in the response.
	private int parentCount;

	public boolean isForceRenderParent() {
		return forceRenderParent;
	}

	public void setForceRenderParent(boolean forceRenderParent) {
		this.forceRenderParent = forceRenderParent;
	}

	private boolean goToLastPage;

	/* If true that means we only want to load a NodeInfo for the actual node specified and not any children */
	private boolean singleNode;

	@JsonProperty(required = false)
	private boolean forceIPFSRefresh;

	@JsonProperty(required = false)
	public boolean isForceIPFSRefresh() {
		return forceIPFSRefresh;
	}

	@JsonProperty(required = false)
	public void setForceIPFSRefresh(boolean forceIPFSRefresh) {
		this.forceIPFSRefresh = forceIPFSRefresh;
	}

	public String getNodeId() {
		return nodeId;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	@JsonProperty(required = false)
	public boolean isRenderParentIfLeaf() {
		return renderParentIfLeaf;
	}

	public void setRenderParentIfLeaf(boolean renderParentIfLeaf) {
		this.renderParentIfLeaf = renderParentIfLeaf;
	}

	public int getOffset() {
		return offset;
	}

	public void setOffset(int offset) {
		this.offset = offset;
	}

	public boolean isGoToLastPage() {
		return goToLastPage;
	}

	public void setGoToLastPage(boolean goToLastPage) {
		this.goToLastPage = goToLastPage;
	}

	public int getSiblingOffset() {
		return siblingOffset;
	}

	public void setSiblingOffset(int siblingOffset) {
		this.siblingOffset = siblingOffset;
	} 

	public boolean isSingleNode() {
		return singleNode;
	}

	public void setSingleNode(boolean singleNode) {
		this.singleNode = singleNode;
	}

	public boolean isUpLevel() {
		return upLevel;
	}

	public void setUpLevel(boolean upLevel) {
		this.upLevel = upLevel;
	}

	public int getParentCount() {
		return parentCount;
	}

	public void setParentCount(int parentCount) {
		this.parentCount = parentCount;
	}
}
