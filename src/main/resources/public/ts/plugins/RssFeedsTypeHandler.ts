import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Clearfix } from "../comp/Clearfix";
import { Div } from "../comp/Div";
import { Heading } from "../comp/Heading";
import { HelpButton } from "../comp/HelpButton";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssFeedsTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.RSS_FEEDS, "RSS Feeds", "fa-rss", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.delete:
                return true;
            default:
                return false;
        }
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new ButtonBar([
                new Button("Add RSS Feed", () => S.edit.createNode(node, J.NodeType.RSS_FEED, true, false, null, null, state), {
                    title: "Add a new RSS Feed Subscription"
                })
            ], null, "float-end"),
            new Heading(4, "RSS Feed Subscriptions", {
                className: "marginAll"
            })
            // new Clearfix(),
            // new HelpButton(() => S.quanta?.config?.help?.type?.friendsList?.render)
        ]);
    }
}
