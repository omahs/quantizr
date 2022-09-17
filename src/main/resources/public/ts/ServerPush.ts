import { dispatch, getAppState } from "./AppContext";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { TimelineTab } from "./tabs/data/TimelineTab";

// reference: https://www.baeldung.com/spring-server-sent-events
// See also: AppController.java#serverPush

declare const g_brandingAppName: string;

export class ServerPush {
    eventSource: EventSource;

    close = (): any => {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    init = (): any => {
        // if already inititlized do nothing
        if (this.eventSource) return;

        console.log("ServerPush.init");
        this.eventSource = new EventSource(S.rpcUtil.getRpcPath() + "serverPush");

        // DO NOT DELETE.
        // eventSource.onmessage = e => {
        // };

        this.eventSource.onopen = (e: any) => {
            // onsole.log("ServerPush.onopen" + e);
        };

        this.eventSource.onerror = (e: any) => {
            // console.log("ServerPush.onerror:" + e);
        };

        this.eventSource.addEventListener("sessionTimeout", async (e: any) => {
            // console.log("event: sessionTimeout.");
            S.quanta.authToken = null;
            S.quanta.userName = null;
            if (S.quanta.loggingOut) return;

            // this might work ok, but for now, let's just force a page repload
            // let state = getAppState();
            // S.nav.login(state);
            // window.location.href = window.location.origin;

            let message = "";
            const editorData = await S.localDB.getVal(C.STORE_EDITOR_DATA);
            if (editorData?.nodeId && editorData?.content) {
                message = "<p><p>Click to resume editing.";
            }

            new MessageDlg("Your session has ended due to inactivity." + message, g_brandingAppName,
                () => {
                    history.go(0);
                }, null, false, 0, "app-modal-content-tiny-width"
            ).open();
        });

        this.eventSource.addEventListener("nodeEdited", (e: any) => {
            const obj: J.FeedPushInfo = JSON.parse(e.data);
            const nodeInfo = obj.nodeInfo;

            if (nodeInfo) {
                dispatch("RenderTimelineResults", s => {
                    const data = TimelineTab.inst;
                    if (!data) return;

                    if (data.props.results) {
                        // remove this nodeInfo if it's already in the results.
                        data.props.results = data.props.results.filter((ni: J.NodeInfo) => ni.id !== nodeInfo.id);

                        // now add to the top of the list.
                        data.props.results.unshift(nodeInfo);
                    }
                    return s;
                });
            }
        });

        this.eventSource.addEventListener("feedPush", (e: any) => {
            const state = getAppState();
            const data: J.FeedPushInfo = JSON.parse(e.data);
            this.feedPushItem(data.nodeInfo, state);
        }, false);

        this.eventSource.addEventListener("ipsmPush", (e: any) => {
            const state = getAppState();
            const data: J.IPSMPushInfo = JSON.parse(e.data);
            // console.log("IPSM: " + data.payload);
            this.ipsmPushItem(data.payload, state);
        }, false);

        this.eventSource.addEventListener("pushPageMessage", (e: any) => {
            const data: J.PushPageMessage = JSON.parse(e.data);
            // console.log("pagePushMessage: " + data.payload);
            if (data.usePopup) {
                S.util.showMessage(data.payload, "Admin Message");
            }
            else {
                S.util.showPageMessage(data.payload);
            }
        }, false);

        this.eventSource.addEventListener("newInboxNode", (e: any) => {
            // const obj: J.NotificationMessage = JSON.parse(e.data);
            // console.log("Incomming Push (NotificationMessage): " + S.util.prettyPrint(obj));
            // new InboxNotifyDlg("Your Inbox has updates!").open();
        }, false);
    }

    forceFeedItem = (nodeInfo: J.NodeInfo, state: AppState) => {
        if (!nodeInfo) return;
        FeedTab.inst.props.feedResults = FeedTab.inst.props.feedResults || [];

        const itemFoundIdx = FeedTab.inst.props.feedResults.findIndex(item => item.id === nodeInfo.id);
        const updatesExistingItem = itemFoundIdx !== -1;

        if (nodeInfo.content && nodeInfo.content.startsWith(J.Constant.ENC_TAG)) {
            nodeInfo.content = "[Encrypted]";
        }

        /* if the reciept of this server push makes us have new knowledge that one of our nodes
           that didn't have children before now has children then update the state to have 'hasChildren'
           on this node so the 'open' button will appear */
        // S.util.refreshOpenButtonOnNode(nodeInfo, state);

        // if updates existing item we refresh it even if autoRefresh is off
        if (updatesExistingItem) {
            // console.log("force*** update existing item!");
            FeedTab.inst.props.feedResults[itemFoundIdx] = nodeInfo;
        }
        else {
            // console.log("force*** push new item");
            FeedTab.inst.props.feedResults.unshift(nodeInfo);
            // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
            // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
            // s.feedResults = S.quanta.removeRedundantFeedItems(s.feedResults);
        }
    }

    ipsmPushItem = (payload: string, state: AppState) => {
        // IPSM currently disabled
        // const feedData: TabIntf = S.tabUtil.getTabDataById(state, C.TAB_IPSM);
        // if (!feedData) return;

        // dispatch("RenderIPSMFeedResults", s => {
        //     feedData.props.events = feedData.props.events || [];

        //     // add to head of array (rev-chron view)
        //     feedData.props.events.unshift(payload);
        //     return s;
        // });
    }

    feedPushItem = (nodeInfo: J.NodeInfo, state: AppState) => {
        if (!nodeInfo) return;

        console.log("feedPushItem: " + nodeInfo.content);
        if (!FeedTab.inst) return;

        const isMine = S.props.isMine(nodeInfo, state);

        if (nodeInfo.content && nodeInfo.content.startsWith(J.Constant.ENC_TAG)) {
            nodeInfo.content = "[Encrypted]";
        }

        /* Ignore changes comming in during edit if we're editing on feed tab (inline)
         which will be fine because in this case when we are done editing we always
         process all the accumulated feedDirtyList items. */
        if (state.activeTab === C.TAB_FEED && state.editNode) {
            // console.log("editing, so adding to feedDirty");
            FeedTab.inst.props.feedDirtyList = FeedTab.inst.props.feedDirtyList || [];
            FeedTab.inst.props.feedDirtyList.push(nodeInfo);
            return;
        }

        dispatch("RenderFeedResults", s => {
            FeedTab.inst.props.feedResults = FeedTab.inst.props.feedResults || [];

            const itemFoundIdx = FeedTab.inst.props.feedResults.findIndex(item => item.id === nodeInfo.id);
            const updatesExistingItem = itemFoundIdx !== -1;

            /* if the reciept of this server push makes us have new knowledge that one of our nodes
               that didn't have children before now has children then update the state to have 'hasChildren'
               on this node so the 'open' button will appear */
            // S.util.refreshOpenButtonOnNode(nodeInfo, s);

            // if updates existing item we refresh it even if autoRefresh is off
            if (updatesExistingItem) {
                // console.log("update existing item!");
                S.render.fadeInId = nodeInfo.id;
                FeedTab.inst.props.feedResults[itemFoundIdx] = nodeInfo;
            }
            // else if autoRefresh is on we can add this node to the display, or if autoRefresh is off
            // we still want to display it if we owned it. Otherwise we tried to do a post and it didn't show up
            // and that will seem odd to the user.
            else if (FeedTab.inst.props.autoRefresh || nodeInfo.owner === s.userName) {
                // console.log("adding in new item.");

                // NOTE: It would be also possible to call delayedRefreshFeed() here instead, but for now
                // I think we can just display any messages we get pushed in, and not try to query the server
                // again just for performance reasons.
                // S.srch.delayedRefreshFeed(s);

                // this is a slight hack to cause the new rows to animate their background, but it's ok, and I plan to leave it like this
                S.render.fadeInId = nodeInfo.id;
                FeedTab.inst.props.feedResults.unshift(nodeInfo);

                if (!isMine) {
                    S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                }

                // scan for any nodes in feedResults where nodeInfo.parent.id is found in the list nodeInfo.id, and
                // then remove the nodeInfo.id from the list becasue it would be redundant in the list.
                // s.feedResults = S.quanta.removeRedundantFeedItems(s.feedResults);
            }
            // or finally if autoRefresh is off we just set feedDirty, and it's up to the user to click refresh
            // button themselves.
            else {
                // console.log("Setting feed dirty.");
                if (!isMine) {
                    S.util.showSystemNotification("New Message", "From " + nodeInfo.owner + ": " + nodeInfo.content);
                }

                /* note: we could que up the incomming nodeInfo, and then avoid a call to the server but for now we just
                keep it simple and only set a dirty flag */
                FeedTab.inst.props.feedDirty = true;
            }
            return s;
        });
    }
}
