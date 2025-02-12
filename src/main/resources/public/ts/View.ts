import { dispatch, getAppState } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Constants as C } from "./Constants";
import { NodeStatsDlg } from "./dlg/NodeStatsDlg";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

// These are magically defined in webpack.common.js;
declare const BUILDTIME: string;
declare const PROFILE: string;

export class View {
    docElm: any = (document.documentElement || document.body.parentNode || document.body);

    jumpToId = (id: string, forceRenderParent: boolean = false) => {
        const ast = getAppState();
        if (C.DEBUG_SCROLLING) {
            console.log("view.jumpToId");
        }
        this.refreshTree({
            nodeId: id,
            zeroOffset: true,
            renderParentIfLeaf: true,
            highlightId: id,
            forceIPFSRefresh: false,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent,
            ast
        });
    }

    /*
     * newId is optional and if specified makes the page scroll to and highlight that node upon re-rendering.
     */
    refreshTree = async (a: RefreshTreeArgs) => {
        if (!a.nodeId && a.ast.node) {
            a.nodeId = a.ast.node.id;
        }

        if (!a.highlightId) {
            const currentSelNode = S.nodeUtil.getHighlightedNode(a.ast);
            a.highlightId = currentSelNode ? currentSelNode.id : a.nodeId;
        }

        let offset = 0;
        if (!a.zeroOffset) {
            const firstChild = S.edit.getFirstChildNode(a.ast);
            offset = firstChild ? firstChild.logicalOrdinal : 0;
        }

        /* named nodes aren't persisting in url without this and i may decide to just get rid
         of 'renderParentIfLeaf' altogether (todo-2) but for now i'm just fixing the case when we are
         rendering a named node. */
        if (a.nodeId.indexOf(":") !== -1) {
            a.renderParentIfLeaf = false;
        }

        try {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: a.nodeId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: a.renderParentIfLeaf,
                forceRenderParent: a.forceRenderParent,
                offset,
                goToLastPage: false,
                forceIPFSRefresh: a.forceIPFSRefresh,
                singleNode: false,
                parentCount: a.ast.userPrefs.showParents ? 1 : 0
            });

            if (!res || !res.success) {
                console.log("Unable to access node: "+a.nodeId);
                return;
            }

            if (C.DEBUG_SCROLLING) {
                console.log("refreshTree -> renderPage (scrollTop=" + a.scrollToTop + ")");
            }
            S.render.renderPage(res, a.scrollToTop, a.highlightId, a.setTab, a.allowScroll);
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
        }
    }

    firstPage = (ast: AppState) => {
        this.loadPage(false, 0, false, ast);
    }

    prevPage = (ast: AppState) => {
        const firstChild = S.edit.getFirstChildNode(ast);
        if (firstChild && firstChild.logicalOrdinal > 0) {
            let targetOffset = firstChild.logicalOrdinal - J.ConstantInt.ROWS_PER_PAGE;
            if (targetOffset < 0) {
                targetOffset = 0;
            }

            this.loadPage(false, targetOffset, false, ast);
        }
    }

    nextPage = (ast: AppState) => {
        const lastChild = S.edit.getLastChildNode(ast);
        if (lastChild) {
            const targetOffset = lastChild.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, false, ast);
        }
    }

    lastPage = (ast: AppState) => {
        // nav.mainOffset += J.ConstantInt.ROWS_PER_PAGE;
        // this.loadPage(true, targetOffset, state);
    }

    /* As part of 'infinite scrolling', this gets called when the user scrolls to the end of a page and we
    need to load more records automatically, and add to existing page records */
    growPage = (ast: AppState) => {
        const lastChild = S.edit.getLastChildNode(ast);
        if (lastChild) {
            const targetOffset = lastChild.logicalOrdinal + 1;
            this.loadPage(false, targetOffset, true, ast);
        }
    }

    /* Note: if growingPage==true we preserve the existing row data, and append more rows onto the current view */
    private loadPage = async (goToLastPage: boolean, offset: number, growingPage: boolean, ast: AppState) => {
        try {
            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: ast.node.id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: true,
                forceRenderParent: false,
                offset,
                goToLastPage,
                forceIPFSRefresh: false,
                singleNode: false,
                parentCount: ast.userPrefs.showParents ? 1 : 0
            });

            if (!res.node) return;

            // if this is an "infinite scroll" call to load in additional nodes
            if (growingPage) {
                /* if the response has some children, and we already have local children we can add to, and we haven't reached
                max dynamic rows yet, then make our children equal the concatenation of existing rows plus new rows */
                if (res?.node?.children && ast?.node?.children) {
                    // create a set for duplicate detection
                    const idSet: Set<string> = new Set<string>();

                    // load set for known children.
                    ast.node.children.forEach(child => idSet.add(child.id));

                    // assign 'res.node.chidren' as the new list appending in the new ones with dupliates removed.
                    res.node.children = ast.node.children.concat(res.node.children.filter(child => !idSet.has(child.id)));
                }
                S.render.renderPage(res, false, null, false, false);
            }
            // else, loading in a page which overrides and discards all existing nodes in browser view
            else {
                if (C.DEBUG_SCROLLING) {
                    console.log("loadPage -> renderPage (scrollTop=true)");
                }
                S.render.renderPage(res, true, null, true, true);
            }
        }
        catch (e) {
            S.nodeUtil.clearLastNodeIds();
        }
    }

    // NOTE: Method not still being used. Let's keep it for future reference
    // scrollRelativeToNode = (dir: string, ast: AppState) => {
    //     const currentSelNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
    //     if (!currentSelNode) return;

    //     let newNode: J.NodeInfo = null;

    //     // First detect if page root node is selected, before doing a child search
    //     if (currentSelNode.id === state.node.id) {
    //         // if going down that means first child node.
    //         if (dir === "down" && state.node.children?.length > 0) {
    //             newNode = state.node.children[0];
    //         }
    //         else if (dir === "up") {
    //             S.nav.navUpLevel(false);
    //         }
    //     }
    //     else if (state.node.children && state.node.children.length > 0) {
    //         let prevChild = null;
    //         let nodeFound = false;

    //         state.node.children.some((child: J.NodeInfo) => {
    //             let ret = false;

    //             if (nodeFound && dir === "down") {
    //                 ret = true;
    //                 newNode = child;
    //                 S.nodeUtil.highlightNode(child, true, state);
    //             }

    //             if (child.id === currentSelNode.id) {
    //                 if (dir === "up") {
    //                     if (prevChild) {
    //                         ret = true;
    //                         newNode = prevChild;
    //                     }
    //                     else {
    //                         newNode = state.node;
    //                     }
    //                 }
    //                 nodeFound = true;
    //             }
    //             prevChild = child;
    //             return ret; // NOTE: returning true stops the iteration.
    //         });
    //     }
    //     if (newNode) {
    //         dispatch("HighlightAndScrollToNode", s => {
    //             S.nodeUtil.highlightNode(newNode, true, s);
    //             return s;
    //         });
    //     }
    // }

    scrollActiveToTop = (ast: AppState) => {
        if (C.DEBUG_SCROLLING) {
            console.log("scrollAllTop");
        }
        const activeTabComp = S.tabUtil.getActiveTabComp(ast);
        if (activeTabComp?.getRef()) {
            activeTabComp.setScrollTop(0);
        }
    }

    scrollToNode = (ast: AppState, node: J.NodeInfo = null, delay: number = 100) => {
        if (!Comp.allowScrollSets) return;

        const func = () => {
            setTimeout(() => {
                /* Check to see if we are rendering the top node (page root), and if so
                it is better looking to just scroll to zero index, because that will always
                be what user wants to see */
                node = node || S.nodeUtil.getHighlightedNode(ast);

                /* the scrolling got slightly convoluted, so I invented 'editNodeId' just to be able to detect
                 a case where the user is editing a node and we KNOW we don't need to scroll after editing,
                 so this is where we detect and reset that scenario. */
                if (!node || node.id === S.quanta.noScrollToId) {
                    return;
                }

                if (ast.node.id === node.id) {
                    this.scrollActiveToTop(ast);
                    return;
                }

                const elm = S.domUtil.domElm(S.nav._UID_ROWID_PREFIX + node.id);
                elm?.scrollIntoView(true);
            }, delay);
        };

        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            func();
        });
    }

    scrollToTop = async () => {
        PubSub.subSingleOnce(C.PUBSUB_mainWindowScroll, () => {
            this.scrollActiveToTop(getAppState());
        });
    }

    getNodeStats = async (ast: AppState, trending: boolean, feed: boolean): Promise<any> => {
        const node = S.nodeUtil.getHighlightedNode(ast);
        const isMine = !!node && (node.owner === ast.userName || ast.userName === J.PrincipalName.ADMIN);

        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending,
            feed,
            getWords: isMine,
            getTags: isMine,
            getMentions: isMine,
            signatureVerify: false
        });
        new NodeStatsDlg(res, trending, feed).open();
    }

    signSubGraph = async (ast: AppState): Promise<any> => {
        if (!S.crypto.warnIfEncKeyUnknown()) {
            return null;
        }
        const node = S.nodeUtil.getHighlightedNode(ast);
        await S.rpcUtil.rpc<J.SignSubGraphRequest, J.SignSubGraphResponse>("signSubGraph", {
            nodeId: node ? node.id : null
        });
        S.util.showMessage("Signature generation initiated. Leave this browser window open until notified signatures are complete.", "Signatures");
    }

    getNodeSignatureVerify = async (ast: AppState): Promise<any> => {
        const node = S.nodeUtil.getHighlightedNode(ast);
        const res = await S.rpcUtil.rpc<J.GetNodeStatsRequest, J.GetNodeStatsResponse>("getNodeStats", {
            nodeId: node ? node.id : null,
            trending: false,
            feed: false,
            getWords: false,
            getTags: false,
            getMentions: false,
            signatureVerify: true
        });
        new NodeStatsDlg(res, false, false).open();
    }

    runServerCommand = async (command: string, parameter: string, dlgTitle: string, dlgDescription: string, ast: AppState) => {
        const node = S.nodeUtil.getHighlightedNode(ast);

        const res = await S.rpcUtil.rpc<J.GetServerInfoRequest, J.GetServerInfoResponse>("getServerInfo", {
            command,
            parameter,
            nodeId: node ? node.id : null
        });

        if (res.messages) {
            res.messages.forEach(m => {
                /* a bit confusing here but this command is the same as the name of the AJAX call above (getServerInfo), but
              there are other commands that exist also */
                if (command === "getServerInfo") {
                    m.message += "\nBrowser Memory: " + S.util.getBrowserMemoryInfo() + "\n";
                    m.message += "Build Time: " + BUILDTIME + "\n";
                    m.message += "Profile: " + PROFILE + "\n";
                }

                /* For now just prefix description onto the text. This will be made 'prettier' later todo-2 */
                if (dlgDescription) {
                    m.message = dlgDescription + "\n\n" + m.message;
                }

                dispatch("showServerInfo", s => {
                    S.tabUtil.tabChanging(s.activeTab, C.TAB_SERVERINFO, s);
                    s.activeTab = S.quanta.activeTab = C.TAB_SERVERINFO;
                    s.serverInfoText = m.message;
                    s.serverInfoCommand = command;
                    s.serverInfoTitle = dlgTitle;
                    return s;
                });
            });
        }
    }
}

interface RefreshTreeArgs {
    nodeId: string;
    zeroOffset: boolean;
    renderParentIfLeaf: boolean;
    highlightId: string;
    forceIPFSRefresh: boolean;
    scrollToTop: boolean;
    allowScroll: boolean;
    setTab: boolean;
    forceRenderParent: boolean;
    ast: AppState
}
