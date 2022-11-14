import { useAppState } from "../../AppContext";
import { CompIntf } from "../../comp/base/CompIntf";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Clearfix } from "../core/Clearfix";
import { PropTable } from "../PropTable";
import { NodeCompBinary } from "./NodeCompBinary";

export class NodeCompContent extends Div {
    domPreUpdateFunc: Function;

    constructor(public node: J.NodeInfo,
        public tabData: TabIntf<any>,
        public rowStyling: boolean,
        public showHeader: boolean,
        public idPrefix: string,
        public isFeed: boolean,
        public isTreeView: boolean,
        public isLinkedNode: boolean,
        public wrapperClass: string) {
        super(null, {
            id: (idPrefix ? idPrefix : "n") + node?.id,
            className: wrapperClass
        });
    }

    preRender(): void {
        const state = useAppState();

        if (!this.node) {
            this.setChildren(null);
            return;
        }

        const children: CompIntf[] = [];
        let typeHandler = S.plugin.getTypeHandler(this.node.type);
        typeHandler = typeHandler || S.plugin.getTypeHandler(J.NodeType.NONE);

        this.domPreUpdateFunc = typeHandler.getDomPreUpdateFunction;
        children.push(typeHandler.render(this.node, this.tabData, this.rowStyling, this.isTreeView, this.isLinkedNode, state));

        if (state.userPrefs.showProps && this.node.properties?.length > 0) {
            children.push(new PropTable(this.node));
            children.push(new Clearfix());
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
         showing the normal attachment for this node, because that will the same as the avatar */
        const isAccountNode = this.node.ownerId && this.node.id === this.node.ownerId;

        if (S.props.hasBinary(this.node) && !isAccountNode) {
            const attComps: CompIntf[] = [];
            S.props.getOrderedAttachments(this.node).forEach(att => {
                // having 'att.key' is a client-side only hack, and only generated during the ordering,
                // so we break a bit of type safety here.

                // show it here only if there's no "position(p)" for it, becasue the positioned ones are layed out
                // via html in 'render.injectSubstitutions'
                if (!att.p || att.p === "auto") {
                    attComps.push(new NodeCompBinary(this.node, (att as any).key, false, false));
                }
            });
            children.push(new Div(null, { className: "rowImageContainer" }, attComps));
        }

        this.maybeRenderDateTime(children, J.NodeProp.DATE, this.node);
        this.setChildren(children);
    }

    maybeRenderDateTime = (children: CompIntf[], propName: string, node: J.NodeInfo) => {
        const timestampVal = S.props.getPropStr(propName, node);
        if (timestampVal) {
            const dateVal: Date = new Date(parseInt(timestampVal));
            const diffTime = dateVal.getTime() - (new Date().getTime());
            const diffDays: number = Math.round(diffTime / (1000 * 3600 * 24));
            let diffStr = "";
            if (diffDays === 0) {
                diffStr = " (today)";
            }
            else if (diffDays > 0) {
                if (diffDays === 1) {
                    diffStr = " (tomorrow)";
                }
                else {
                    diffStr = " (" + diffDays + " days away)";
                }
            }
            else if (diffDays < 0) {
                if (diffDays === -1) {
                    diffStr = " (yesterday)";
                }
                else {
                    diffStr = " (" + Math.abs(diffDays) + " days ago)";
                }
            }

            // if more than two days in future or past we don't show the time, just the date
            const when = (diffDays <= -2 || diffDays >= 2) ? S.util.formatDateShort(dateVal) : S.util.formatDateTime(dateVal);
            children.push(new Div(when + " " + S.util.getDayOfWeek(dateVal) + diffStr, {
                className: "dateTimeDisplay float-end"
            }));
            children.push(new Clearfix());
        }
    }

    domPreUpdateEvent = () => {
        if (this.domPreUpdateFunc) {
            this.domPreUpdateFunc(this);
        }
    }
}
