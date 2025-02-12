import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { SharesRSInfo } from "../../SharesRSInfo";
import { S } from "../../Singletons";
import { SharedNodesResultSetView } from "../SharedNodesResultSetView";

export class SharesTab implements TabIntf<SharesRSInfo> {
    name = "Shared Nodes";
    tooltip = "Shows all the Shared nodes made accessible to other users";
    id = C.TAB_SHARES;
    isVisible = (ast: AppState) => S.tabUtil.resultSetHasData(C.TAB_SHARES);
    constructView = (data: TabIntf) => new SharedNodesResultSetView<SharesRSInfo>(data);
    getTabSubOptions = (ast: AppState): Div => { return null; };
    props = new SharesRSInfo();
    scrollPos: 0;
    openGraphComps: [];
    topmostVisibleElmId: string = null;

    static inst: SharesTab = null;
    constructor() {
        SharesTab.inst = this;
    }

    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted = (ast: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (ast: AppState, newNode: J.NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }
}
