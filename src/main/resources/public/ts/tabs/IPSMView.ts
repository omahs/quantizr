import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { HelpButton } from "../comp/core/HelpButton";
import { TabDataIntf } from "../intf/TabDataIntf";

export class IPSMView extends AppTab {
    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = this.getClass(state);
        let children: Comp[] = [];

        children.push(new Div(null, null, [
            new Div(null, { className: "marginTop" }, [
                this.renderHeading(state)
            ]),
            new Div("Realtime IPFS PubSub events from ipsm-heartbeat topic..."),
            new HelpButton(() => {
                return "IPSM Console\nThis is a diagnostic view which shows unfiltered IPFS PubSub messages " + //
                    " being posted to 'ipsm-heartbeat'. Peers can send up to only 10 events per minute, and messages " + //
                    " sent at a faster rate than that, from any specific peer, get ignored.";
            })
        ]));

        if (this.data.props?.events) {
            this.data.props.events.forEach((e: string) => {
                children.push(new Div(e, { className: "ipsmFeedItem" }));
            });
        }

        this.setChildren([new Div(null, { className: "feedView" }, children)]);
    }

    /* overridable (don't use arrow function) */
    renderHeading(state: AppState): CompIntf {
        return new Heading(4, "IPSM Console", { className: "resultsTitle" });
    }
}
