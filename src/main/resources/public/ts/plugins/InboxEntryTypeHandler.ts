import { AppState } from "../AppState";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class InboxEntryTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX_ENTRY, "Notification", "fa-envelope", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.delete:
                return true;
            default:
                return false;
        }
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return false;
    }

    // render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
    //     return new Div(null, null, [
    //         new NodeCompMarkdown(node, state),
    //         new Div(null, { className: "marginLeft" }, [
    //             new Icon({
    //                 title: "Reply",
    //                 className: "fa fa-comment fa-lg rowFooterIcon",
    //                 onClick: () => S.edit.addNode(node, null, state)
    //             })
    //         ])
    //     ]);
    // }
}
