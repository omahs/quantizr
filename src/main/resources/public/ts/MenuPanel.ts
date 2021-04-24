import { useSelector } from "react-redux";
import { appState } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { ImportCryptoKeyDlg } from "./dlg/ImportCryptoKeyDlg";
import { ManageEncryptionKeysDlg } from "./dlg/ManageEncryptionKeysDlg";
import { MediaRecorderDlg } from "./dlg/MediaRecorderDlg";
import { SearchAndReplaceDlg } from "./dlg/SearchAndReplaceDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SearchUsersDlg } from "./dlg/SearchUsersDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Div } from "./widget/Div";
import { Menu } from "./widget/Menu";
import { MenuItem } from "./widget/MenuItem";
import { MenuItemSeparator } from "./widget/MenuItemSeparator";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

/* todo-1: We don't need to be generating NEW function instances (fat arrows) in here every time
 because we can just pre-create each function and hold in static vars
 and each one can query for the state dynamically. This is all fixed except for the admin ones because those only
 affect the admin and are lower priority to fix */
export class MenuPanel extends Div {

    constructor(state: AppState) {
        super(null, {
            id: "accordion",
            role: "tablist",
            className: "menuPanel"
        });
    }

    static openUserGuide = () => S.nav.openContentNode(":user-guide");
    static openNotesNode = () => S.nav.openContentNode("~" + J.NodeType.NOTES);
    static openFriendsNode = () => S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST);
    static openPostsNode = () => S.nav.openContentNode("~" + J.NodeType.POSTS);
    static openExportsNode = () => S.nav.openContentNode("~" + J.NodeType.EXPORTS);
    static transferNode = () => { new TransferNodeDlg(appState(null)).open(); };
    static searchAndReplace = () => { new SearchAndReplaceDlg(appState(null)).open(); };
    static splitNode = () => { new SplitNodeDlg(null, appState(null)).open(); }
    static joinNodes = () => { S.edit.joinNodes(); }
    static showPublicWritableShares = () => { S.share.findSharedNodes(null, "public", J.PrivilegeType.WRITE); }
    static showPublicReadonlyShares = () => { S.share.findSharedNodes(null, "public", J.PrivilegeType.READ); }
    static showAllShares = () => { S.share.findSharedNodes(null, null, null); }
    static searchByContent = () => { new SearchContentDlg(appState(null)).open(); };
    static searchByName = () => { new SearchByNameDlg(appState(null)).open(); }
    static searchById = () => { new SearchByIDDlg(appState(null)).open(); };
    static findUsers = () => { new SearchUsersDlg(appState(null)).open(); };
    static timelineByCreated = () => S.srch.timeline("ctm", appState(null), null, "Timeline based on Create Time");
    static timelineByModified = () => S.srch.timeline("mtm", appState(null), null, "Timeline based on Modification Time");
    static showCalendar = () => { S.render.showCalendar(null, appState(null)); }
    static calendarFutureDates = () => S.srch.timeline("prp.date.value", appState(null), "futureOnly", "Future calendar dates (Soonest at the top)");
    static calendarPastDates = () => S.srch.timeline("prp.date.value", appState(null), "pastOnly", "Past calendar dates (Newest at the top)");
    static calendarAllDates = () => S.srch.timeline("prp.date.value", appState(null), "all", "All calendar dates");
    static toolsShowGraph = () => S.render.showGraph(null, null, appState(null));
    static toolsShowClipboard = () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
    static import = () => S.edit.openImportDlg(appState(null));
    static export = () => S.edit.openExportDlg(appState(null));
    static testMicrophone = () => { new MediaRecorderDlg(appState(null), false, false).open(); };
    static testWebCam = () => { new MediaRecorderDlg(appState(null), true, false).open(); };
    static mouseEffects = () => { S.meta64.toggleMouseEffect(); };
    static showUrls = () => S.render.showNodeUrl(null, appState(null));
    static showRawData = () => S.view.runServerCommand("getJson", "Node JSON Data", "The actual data stored on the server for this node...", appState(null));
    static nodeStats = () => S.view.getNodeStats(appState(null), false, false);

    static showKeys = () => {
        new ConfirmDlg("Warning: Be sure you aren't sharing your screen. Security keys will be displayed!!", "Show Encryption Keys",
            () => {
                new ManageEncryptionKeysDlg(appState(null)).open();
            },
            null, "btn-danger", "alert alert-danger", appState(null)
        ).open();
    };

    static generateKeys = () => { S.util.generateNewCryptoKeys(appState(null)); };
    static publishKeys = () => { S.encryption.initKeys(false, true); };
    static importKeys = () => { new ImportCryptoKeyDlg(appState(null)).open(); };
    static profile = () => {
        new UserProfileDlg(false, null, appState(null)).open();
    };

    static toggleEditMode = () => S.edit.toggleEditMode(appState(null));
    static toggleMetaData = () => S.edit.toggleShowMetaData(appState(null));
    static manageAccount = () => S.edit.openManageAccountDlg(appState(null));
    static browserInfo = () => S.util.showBrowserInfo();
    static mobileToggle = () => S.util.switchBrowsingMode(appState(null));

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        const hltNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        const selNodeIsMine = !!hltNode && (hltNode.owner === state.userName || state.userName === "admin");

        const importFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);
        const exportFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);

        const orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, hltNode);
        const allowNodeMove: boolean = !orderByProp && S.edit.isInsertAllowed(state.node, state);
        const isPageRootNode = state.node && hltNode && state.node.id === hltNode.id;
        const canMoveUp = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && hltNode.logicalOrdinal > 0);
        const canMoveDown = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && !hltNode.lastChild);

        // todo-0: these menu items have changed order and location, so we need to update the User Guide
        const children = [];

        children.push(new Menu(C.SITE_NAV_MENU_TEXT, [
            ...this.siteNavCustomItems(state),
            new MenuItem("Portal Home", S.meta64.loadAnonPageHome),
            new MenuItem("User Guide", MenuPanel.openUserGuide),
            !state.isAnonUser ? new MenuItemSeparator() : null, //
            !state.isAnonUser ? new MenuItem("Logout", S.nav.logout, !state.isAnonUser) : null
        ]));

        children.push(new Menu("My Nodes", [
            new MenuItem("Account", S.nav.navHome, !state.isAnonUser),
            new MenuItem("Notes", MenuPanel.openNotesNode, !state.isAnonUser),
            new MenuItem("Friends", MenuPanel.openFriendsNode, !state.isAnonUser),
            new MenuItem("Posted", MenuPanel.openPostsNode, !state.isAnonUser),
            new MenuItem("Exports", MenuPanel.openExportsNode, !state.isAnonUser)
        ]));

        children.push(new Menu("Edit", [
            new MenuItem("Clear Selections", S.meta64.clearSelNodes, !state.isAnonUser), //

            // new MenuItem("Cut", S.edit.cutSelNodes, () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine }), //
            new MenuItem("Undo Cut", S.edit.undoCutSelNodes, !state.isAnonUser && !!state.nodesToMove), //

            // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

            new MenuItem("Transfer Node", MenuPanel.transferNode, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Update Headings", S.edit.updateHeadings, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Search and Replace", MenuPanel.searchAndReplace, !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Split Node", MenuPanel.splitNode, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Join Nodes", MenuPanel.joinNodes, !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Move to Top", S.edit.moveNodeToTop, canMoveUp), //
            new MenuItem("Move to Bottom", S.edit.moveNodeToBottom, canMoveDown), //

            new MenuItemSeparator(), //
            new MenuItem("Delete", S.edit.deleteSelNodes, !state.isAnonUser && selNodeIsMine) //

            // todo-2: disabled during mongo conversion
            // new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
            // new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
            //    () => { return state.isAdminUser && highlightNode != null }, //
            //    () => { return state.isAdminUser }, //
            //    true
            // ), //
        ]));

        let createMenuItems = [];
        let typeHandlers = S.plugin.getAllTypeHandlers();
        typeHandlers.forEach((typeHandler: TypeHandlerIntf, k: string): boolean => {
            if (state.isAdminUser || typeHandler.getAllowUserSelect()) {
                createMenuItems.push(new MenuItem(typeHandler.getName(), () => S.edit.createNode(hltNode, typeHandler.getTypeName(), state), //
                    !state.isAnonUser && !!hltNode));
            }
            return true;
        });

        children.push(new Menu("Create", createMenuItems));

        children.push(new Menu("Share", [
            // moved into editor dialog
            // new MenuItem("Edit Node Sharing", () => S.share.editNodeSharing(state), //
            //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

            new MenuItem("Show All Shares", MenuPanel.showAllShares, //
                !state.isAnonUser && !!hltNode),

            new MenuItem("Show Public Readonly", MenuPanel.showPublicReadonlyShares, //
                !state.isAnonUser && !!hltNode),

            new MenuItem("Show Public Appendable", MenuPanel.showPublicWritableShares, //
                !state.isAnonUser && !!hltNode)
        ]));

        children.push(new Menu("Search", [

            new MenuItem("By Content", MenuPanel.searchByContent, //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("By Name", MenuPanel.searchByName, //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("By ID", MenuPanel.searchById, //
                !state.isAnonUser && !!hltNode), //

            new MenuItemSeparator(), //

            new MenuItem("Find Users", MenuPanel.findUsers, //
                !state.isAnonUser) //

            // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch },
            //    () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch })
        ]));

        children.push(new Menu("Timeline", [

            new MenuItem("Created", MenuPanel.timelineByCreated, //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("Modified", MenuPanel.timelineByModified, //
                !state.isAnonUser && !!hltNode) //
        ]));

        children.push(new Menu("Calendar", [

            !state.isAnonUser ? new MenuItem("Show", MenuPanel.showCalendar, !!hltNode) : null, new MenuItemSeparator(), //

            new MenuItem("Future Dates", MenuPanel.calendarFutureDates, !state.isAnonUser && !!hltNode), //
            new MenuItem("Past Dates", MenuPanel.calendarPastDates, !state.isAnonUser && !!hltNode), //
            new MenuItem("All Dates", MenuPanel.calendarAllDates, !state.isAnonUser && !!hltNode) //
        ]));

        children.push(new Menu("Tools", [
            !state.isAnonUser ? new MenuItem("Show Graph", MenuPanel.toolsShowGraph, !!hltNode) : null, //
            new MenuItem("Save Clipboard", MenuPanel.toolsShowClipboard, !state.isAnonUser), //

            // for now, we don't need the 'show properties' and it may never be needed again
            // new MenuItem("Toggle Properties", S.props.propsToggle, () => { return propsToggle }, () => { return !state.isAnonUser }), //
            new MenuItemSeparator(), //

            new MenuItem("Import", MenuPanel.import, importFeatureEnabled),
            new MenuItem("Export", MenuPanel.export, exportFeatureEnabled),
            new MenuItemSeparator(), //

            new MenuItem("Test Microphone", MenuPanel.testMicrophone, !state.isAnonUser), //
            new MenuItem("Test Web Cam", MenuPanel.testWebCam, !state.isAnonUser), //

            /* The mouse effect shows a grapical animation for each mouse click but I decided I don't like the fact
             that I have to impose an intentional performance lag to let the animation show up, so in order to have the
             absolute fastest snappiest response of the app, I'm just not using this mouseEffect for now but let's leave
             the code in place for future reference. */
            new MenuItemSeparator(), //
            new MenuItem("Mouse Effects", MenuPanel.mouseEffects, !state.isAnonUser)
        ]));

        children.push(new Menu("Node Info", [

            // I decided with this on the toolbar we don't need it repliated here.
            // !state.isAnonUser ? new MenuItem("Save clipboard to my NOTES node", () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES)) : null, //

            new MenuItem("Show URLs", MenuPanel.showUrls, !!hltNode), //
            new MenuItem("Show Raw Data", MenuPanel.showRawData, !state.isAnonUser && selNodeIsMine), //
            new MenuItemSeparator(), //

            // Warning: this can put heavy load on server. Maybe make this kinda thing a "paid" feature?
            new MenuItem("Node Stats", MenuPanel.nodeStats, !state.isAnonUser && selNodeIsMine) //

            // This menu item works, but will have little value to users, because the only difference between this and 'Node Stats', is that
            // the 'trending' stats is defined as the 'Node Stats' for the most recent 500 results in the query. I had a need for this early on
            // because this is how the Feed View (Fediverse) stats is done, using arbitrarily chosen number 500 most recent posts as the universe
            // of data to pick the statistics from, but this arbitrary number 500 just won't be helpful on any sub-graph for any ordinary users (yet)
            // because you'd need a document with many thousands of nodes before the "top 500" will have any real significance as a 'trending' definition.
            // new MenuItem("Trending Stats", () => S.view.getNodeStats(state, true, false), //
            //     !state.isAnonUser /* state.isAdminUser */) //
        ]));

        children.push(new Menu("Encrypt", [
            new MenuItem("Show Keys", MenuPanel.showKeys, !state.isAnonUser), //
            new MenuItem("Generate Keys", MenuPanel.generateKeys, !state.isAnonUser), //
            new MenuItem("Publish Keys", MenuPanel.publishKeys, !state.isAnonUser), //
            new MenuItem("Import Keys", MenuPanel.importKeys, !state.isAnonUser) //
        ]));

        // //need to make export safe for end users to use (recarding file sizes)
        // if (state.isAdminUser) {
        //     children.push(new Menu("Admin Tools", [
        //         //todo-2: disabled during mongo conversion
        //         //new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
        //         //new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
        //         //    () => { return state.isAdminUser && highlightNode != null }, //
        //         //    () => { return state.isAdminUser }, //
        //         //    true
        //         //), //
        //     ]));
        // }

        // WORK IN PROGRESS (do not delete)
        // let fileSystemMenuItems = //
        //     menuItem("Reindex", "fileSysReindexButton", "systemfolder.reindex();") + //
        //     menuItem("Search", "fileSysSearchButton", "systemfolder.search();"); //
        //     //menuItem("Browse", "fileSysBrowseButton", "systemfolder.browse();");
        // let fileSystemMenu = makeTopLevelMenu("FileSys", fileSystemMenuItems);

        children.push(new Menu("Account", [
            new MenuItem("Profile", MenuPanel.profile, !state.isAnonUser), //
            new MenuItem("Manage Account", MenuPanel.manageAccount, !state.isAnonUser), //

            new MenuItemSeparator(), //

            new MenuItem("Toggle Edit Mode", MenuPanel.toggleEditMode, !state.isAnonUser), //
            new MenuItem("Toggle Metadata", MenuPanel.toggleMetaData, !state.isAnonUser), //

            // For now there is only ONE button on the Perferences dialog that is accessible as a toolbar button already, so
            // until we have at least one more preference the preferences dialog is not needed.
            // new MenuItem("Preferences", () => S.edit.editPreferences(state), !state.isAnonUser), // "fa-gear"

            new MenuItemSeparator(), //

            new MenuItem("Browser Info", MenuPanel.browserInfo), //
            new MenuItem(state.mobileMode ? "Desktop App" : "Mobile App", MenuPanel.mobileToggle) //

            // menuItem("Full Repository Export", "fullRepositoryExport", "
            // S.edit.fullRepositoryExport();") + //
        ]));

        /* This was experimental, and does work perfectly well (based on a small aount of testing done).
          These menu items can save a node subgraph to IPFS files (MFS) and the restore those nodes back
          from that tree branch. But the feature is not currently needed or enabled.
          */
        // eslint-disable-next-line no-constant-condition
        if (false && state.isAdminUser) {
            children.push(new Menu("IPFS", [
                new MenuItem("Sync: Nodes to IPFS", () => S.util.publishNodeToIpfs(hltNode), //
                    state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)), //
                new MenuItem("Sync: IPFS to Nodes", () => S.util.loadNodeFromIpfs(hltNode), //
                    state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)) //
            ]));
        }

        if (state.isAdminUser) {
            children.push(new Menu("Admin - Utils", [

                // new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                new MenuItem("Server Info", () => S.view.runServerCommand("getServerInfo", "Server Info", null, state)), //
                new MenuItem("Refresh RSS Cache", () => S.view.runServerCommand("refreshRssCache", "Refresh RSS Cache", null, state)), //
                new MenuItem("Refresh Fediverse", () => S.view.runServerCommand("refreshFediverseUsers", "Refresh Fediverse Users", null, state)), //
                new MenuItem("Reset Public Node", () => S.view.runServerCommand("initializeAppContent", null, null, state)), //
                new MenuItem("Insert Book: War and Peace", () => S.edit.insertBookWarAndPeace(state))
            ]));

            children.push(new Menu("Admin - DB", [

                new MenuItem("Validate", () => S.view.runServerCommand("validateDb", "Validate DB Response", null, state)), //
                new MenuItem("Compact", () => S.view.runServerCommand("compactDb", "Compact DB Response", null, state)), //
                new MenuItem("Rebuild Indexes", () => S.view.runServerCommand("rebuildIndexes", "Rebuild Indexes Response", null, state)), //
                new MenuItem("Lucene: Refresh", () => S.view.runServerCommand("refreshLuceneIndex", null, null, state))
            ]));

            children.push(new Menu("Admin - Test", [
                new MenuItem("TEST - Send Email", () => S.meta64.sendTestEmail()),
                new MenuItem("TEST - Notification Display", () => S.meta64.showSystemNotification("Test Title", "This is a test message")),
                new MenuItem("TEST - Encryption", async () => {
                    await S.encryption.test();
                    S.util.showMessage("Encryption Test Complete. Check browser console for output.", "Note", true);
                }),
                new MenuItem("TEST - Text to Speech", async () => {
                    const tts = window.speechSynthesis;
                    // let voices = tts.getVoices();
                    // for (let i = 0; i < voices.length; i++) {
                    //     let voice = voices[i];
                    //     // Google UK English Female (en-GB)
                    //     console.log("Voice: " + voice.name + " (" + voice.lang + ") " + (voice.default ? "<-- Default" : ""));
                    // }

                    /* WARNING: speechSynthesis seems to crash very often and leave hung processes, eating up CPU, at least
                    on my Ubuntu 18.04, machine, so for now any TTS development is on hold. */
                    var sayThis = new SpeechSynthesisUtterance("Wow. Browsers now support Text to Speech driven by JavaScript");
                    tts.speak(sayThis);
                })
            ]));
        }

        this.setChildren(children);
    }

    siteNavCustomItems = (state: AppState): Div[] => {
        let items: Div[] = [];
        if (S.meta64.config && S.meta64.config.menu && S.meta64.config.menu.siteNav) {
            for (let menuItem of S.meta64.config.menu.siteNav) {
                if (menuItem.name === "separator") {
                    items.push(new MenuItemSeparator());
                }
                else {
                    let link: string = menuItem.link;
                    let func: Function = null;

                    // allows ability to select a tab
                    if (link.startsWith("tab:")) {
                        link = link.substring(4);
                        func = () => S.meta64.selectTab(link);
                    }
                    // covers http and https
                    else if (link.startsWith("http")) {
                        func = () => window.open(link);
                    }
                    // named nodes like ":myName"
                    else {
                        func = () => S.nav.openContentNode(link, state);
                    }

                    items.push(new MenuItem(menuItem.name, func));
                }
            }
        }
        return items;
    }
}
