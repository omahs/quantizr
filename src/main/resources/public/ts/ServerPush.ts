import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { ServerPushIntf } from "./intf/ServerPushIntf";
import { TabDataIntf } from "./intf/TabDataIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { FeedView } from "./tabs/FeedView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

// reference: https://www.baeldung.com/spring-server-sent-events
// See also: AppController.java#serverPush
export class ServerPush implements ServerPushIntf {
    eventSource: EventSource;

    close = (): any => {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    init = (): any => {
        console.log("ServerPush.init");

        this.eventSource = new EventSource(S.util.getRpcPath() + "serverPush");

        // DO NOT DELETE.
        // eventSource.onmessage = e => {
        // };

        this.eventSource.onopen = (e: any) => {
            // onsole.log("ServerPush.onopen" + e);
        };

        this.eventSource.onerror = (e: any) => {
            // console.log("ServerPush.onerror:" + e);
        };

        this.eventSource.addEventListener("sessionTimeout", function (e: any) {
            // console.log("event: sessionTimeout.");
            S.quanta.authToken = null;
            S.quanta.userName = null;
            if (S.quanta.loggingOut) return;

            // this might work ok, but for now, let's just force a page repload
            let state = store.getState();
            // S.nav.login(state);
            // window.location.href = window.location.origin + "/app";

            let dlg = new MessageDlg("Session timed out.", "Quanta",
                () => {
                    // todo-1: need to look for places we should do this instead of the location.href in order to preserve url
                    history.go(0);
                }, null, false, 0, state
            );
            dlg.open();
        });

        this.eventSource.addEventListener("nodeEdited", function (e: any) {
            const obj: J.FeedPushInfo = JSON.parse(e.data);
            const nodeInfo: J.NodeInfo = obj.nodeInfo;

            if (nodeInfo) {
                dispatch("Action_RenderTimelineResults", (s: AppState): AppState => {
                    let data = s.tabData.find(d => d.id === C.TAB_TIMELINE);
                    if (!data) return;

                    if (data.rsInfo.results) {
                        // remove this nodeInfo if it's already in the results.
                        data.rsInfo.results = data.rsInfo.results.filter((ni: J.NodeInfo) => ni.id !== nodeInfo.id);

                        // now add to the top of the list.
                        data.rsInfo.results.unshift(nodeInfo);
                    }
                    return s;
                });
            }
        });

        this.eventSource.addEventListener("feedPush", function (e: any) {
            let state = store.getState();

            const obj: J.FeedPushInfo = JSON.parse(e.data);
            let feedData: TabDataIntf = S.quanta.getTabDataById(null, C.TAB_FEED);
            // console.log("Incomming Push (FeedPushInfo): " + S.util.prettyPrint(obj));

            // Ignore changes comming in during edit if we're editing on feed tab (inline)
            // which will be find because in this case when we are done editing we always
            // do a feedRefresh after editing, because it picks up that we set feedDirty here.
            if (state.activeTab === C.TAB_FEED && state.editNode) {
                feedData.props.feedDirty = true;
                return;
            }

            const nodeInfo: J.NodeInfo = obj.nodeInfo;
            if (nodeInfo) {
                // todo-1: I think this dispatch is working, but another full FeedView refresh (from actual server query too) is somehow following after also
                // so need to check and see how to avoid that.
                dispatch("Action_RenderFeedResults", (s: AppState): AppState => {
                    feedData.props.feedResults = feedData.props.feedResults || [];

                    /* If we detect the incomming change that is our own creation, we display it, but if it's not our own we
                    don't display because for now we aren't doing live feed updates since that can be a nuisance for users to have the
                    page change while they're maybe reading it */
                    if (nodeInfo.owner === s.userName) {

                        // this is a slight hack to cause the new rows to animate their background, but it's ok, and I plan to leave it like this
                        S.render.fadeInId = nodeInfo.id;

                        // if item is already in feedResults replace it, or else put it at the start of the array.
                        let idx = feedData.props.feedResults.findIndex(item => item.id === nodeInfo.id);
                        if (idx === -1) {
                            feedData.props.feedResults.unshift(nodeInfo);
                        } else {
                            feedData.props.feedResults[idx] = (nodeInfo);
                        }

                        // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
                        // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
                        // s.feedResults = S.quanta.removeRedundantFeedItems(s.feedResults);
                    }
                    else {
                        /* note: we could que up the incomming nodeInfo, and then avoid a call to the server but for now we just
                        keep it simple and only set a dirty flag */
                        feedData.props.feedDirty = true;
                        S.srch.feedDirtyNotify(s);
                        if (nodeInfo.content && nodeInfo.content.startsWith(J.Constant.ENC_TAG)) {
                            nodeInfo.content = "[Encrypted]";
                        }

                        /* if the reciept of this server push makes us have new knowledge that one of our nodes
                        that didn't have children before now has children then update the state to have 'hasChildren'
                        on this node so the 'open' button will appear */
                        S.quanta.showOpenButtonOnNode(nodeInfo, s);
                        S.quanta.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                    }
                    return s;
                });
            }
        }, false);

        this.eventSource.addEventListener("newInboxNode", function (e: any) {
            const obj: J.NotificationMessage = JSON.parse(e.data);
            // console.log("Incomming Push (NotificationMessage): " + S.util.prettyPrint(obj));
            // new InboxNotifyDlg("Your Inbox has updates!", store.getState()).open();
        }, false);
    }
}
