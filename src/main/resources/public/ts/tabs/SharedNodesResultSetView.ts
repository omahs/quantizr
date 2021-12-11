import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { TabDataIntf } from "../intf/TabDataIntf";
import { SharesRSInfo } from "../SharesRSInfo";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class SharedNodesResultSetView<I extends SharesRSInfo> extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();
        let info = this.data.rsInfo as I;

        let page = info.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : info.page + delta;
        }

        S.srch.findSharedNodes(info.node,
            page,
            info.shareNodesType,
            info.shareTarget,
            info.accessOption,
            state);
    }
}
