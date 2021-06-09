import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { IconButton } from "../widget/IconButton";
import { Span } from "../widget/Span";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export abstract class ResultSetView extends AppTab {

    constructor(data: TabDataIntf) {
        super(data);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = this.data && this.data.rsInfo.results;
        this.attribs.className = "tab-pane fade my-tab-pane";

        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        let childCount = results.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: Comp[] = [];

        if (this.data.rsInfo.description) {
            let searchText = this.data.rsInfo.node ? S.util.getShortContent(this.data.rsInfo.node.content) : null;
            children.push(new Div(null, null, [
                new Div(null, { className: "marginBottom" }, [
                    new Heading(4, this.data.name, { className: "resultsTitle" }),
                    this.data.rsInfo.node ? new Span(null, { className: "float-right" }, [
                        new IconButton("fa-arrow-left", "Back", {
                            onClick: () => S.view.refreshTree(this.data.rsInfo.node.id, true, true, this.data.rsInfo.node.id, false, true, true, state),
                            title: "Back to Node"
                        })
                    ]) : null
                ]),
                searchText ? new TextContent(searchText, "resultsContentHeading alert alert-secondary") : null,
                new Div(this.data.rsInfo.description)
            ]));
        }

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + data.rsInfo.page + " endReached=" + data.rsInfo.endReached));
        this.addPaginationBar(state, children);

        let i = 0;
        let jumpButton = state.isAdminUser || !this.data.rsInfo.userSearchType;
        results.forEach((node: J.NodeInfo) => {
            S.srch.initSearchNode(node);
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, this.data.id, false, false, true, jumpButton, state));
            i++;
            rowCount++;
        });

        this.addPaginationBar(state, children);
        this.setChildren(children);
    }

    addPaginationBar = (state: AppState, children: Comp[]): void => {
        children.push(new ButtonBar([
            this.data.rsInfo.page > 1 ? new IconButton("fa-angle-double-left", null, {
                onClick: () => this.pageChange(0),
                title: "First Page"
            }) : null,
            this.data.rsInfo.page > 0 ? new IconButton("fa-angle-left", null, {
                onClick: () => this.pageChange(-1),
                title: "Previous Page"
            }) : null,
            !this.data.rsInfo.endReached ? new IconButton("fa-angle-right", "More", {
                onClick: () => this.pageChange(1),
                title: "Next Page"
            }) : null
        ], "text-center marginBottom"));
    }

    abstract pageChange(delta: number): void;
}
