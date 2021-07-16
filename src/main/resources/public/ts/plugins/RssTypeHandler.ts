import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Clearfix } from "../widget/Clearfix";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Html } from "../widget/Html";
import { Icon } from "../widget/Icon";
import { IconButton } from "../widget/IconButton";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";
import { Spinner } from "../widget/Spinner";
import { TextContent } from "../widget/TextContent";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssTypeHandler extends TypeBase {
    static expansionState: any = {};
    static lastGoodFeed: J.RssFeed;
    static lastGoodPage: number;

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.upload:
                return false;
            default:
                return true;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return "RSS Feed URLs (one per line)";
        }
        return propName;
    }

    getEditorRowsForProp(propName: string): number {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return 20;
        }
        return 1;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.RSS_FEED_SRC];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return propName === J.NodeProp.RSS_FEED_SRC;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.RSS_FEED_SRC);
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {

        // console.log("RSSTypeHandler.render");
        let feedSrc: string = S.props.getNodePropVal(J.NodeProp.RSS_FEED_SRC, node);
        if (!feedSrc) {
            return (new TextContent("Set the '" + J.NodeProp.RSS_FEED_SRC + "' node property to the RSS Feed URL.", "alert alert-info marginLeft marginTop"));
        }

        let feedSrcHash = S.util.hashOfString(feedSrc);
        let itemListContainer: Div = new Div("", { className: "rss-feed-listing" });

        // todo-0: make sure these types are still able to be handled.
        // var options = {
        //     customFields: {
        //         item: [
        //             ["media:group", "mediaGroup"],
        //             ["media:content", "mediaContent"],
        //             ["media:thumbnail", "mediaThumbnail"],
        //             ["category", "category"],
        //             ["itunes:image", "itunesImage"],
        //             ["itunes:subtitle", "itunesSubtitle"]
        //         ]
        //     }
        // };

        /*
        If we find the RSS feed in the cache, use it.
        disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to
        figure this out yet.
        */
        if (state.feedCache[feedSrcHash] === "failed") {
            return new Div("Feed Failed: " + feedSrc, {
                className: "marginAll"
            });
        }
        else if (state.feedCache[feedSrcHash] === "loading") {
            return new Div(null, null, [
                new Heading(4, "Loading Feeds..."),
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]);
        }
        /* if the feedCache doesn't contain either "failed" or "loading" then treat it like data and render it */
        else if (state.feedCache[feedSrcHash]) {
            this.renderItem(state.feedCache[feedSrcHash], feedSrc, itemListContainer, state);
        }
        // otherwise read from the internet
        else {
            // update state to 'loading' immediately or else this can reenter.
            dispatch("Action_RSSLoading", (s: AppState): AppState => {
                s.feedCache[feedSrcHash] = "loading";
                return s;
            });

            itemListContainer.addChild(new Heading(4, "Loading RSS Feed..."));
            itemListContainer.addChild(new Div("For large feeds this can take a few seconds..."));

            /* warning: paging here is not zero offset. First page is number 1 */
            let page: number = state.feedPage[feedSrcHash];
            if (!page) {
                page = 1;
                state.feedPage[feedSrcHash] = page;
            }

            // console.log("Reading RSS: " + feedSrc);

            // todo-0: we can get into cases where a fail to render disables the app. Even if user tries to comee back to
            // different url the browser will point them to same one and continue to fail endlessly
            S.util.ajax<J.GetMultiRssRequest, J.GetMultiRssResponse>("getMultiRssFeed", {
                urls: feedSrc,
                page
            }, (res: J.GetMultiRssResponse) => {
                if (!res.feed) {
                    // new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                    // console.log(err.message || "RSS Feed failed to load.");
                    dispatch("Action_RSSUpdated", (s: AppState): AppState => {
                        s.feedCache[feedSrcHash] = "failed";
                        return s;
                    });
                }
                else {
                    // console.log("FEED: " + S.util.prettyPrint(res.feed));

                    dispatch("Action_RSSUpdated", (s: AppState): AppState => {
                        S.meta64.tabScrollTop(s, C.TAB_MAIN);
                        if (!res.feed.entries || res.feed.entries.length === 0) {
                            s.feedCache[feedSrcHash] = RssTypeHandler.lastGoodFeed || {};
                            s.feedPage[feedSrcHash] = RssTypeHandler.lastGoodPage || 1;
                            setTimeout(() => {
                                S.util.showMessage("No more RSS items found.", "RSS");
                            }, 250);
                        }
                        else {
                            s.feedCache[feedSrcHash] = res.feed;
                            RssTypeHandler.lastGoodFeed = res.feed;
                            RssTypeHandler.lastGoodPage = s.feedPage[feedSrcHash];
                        }
                        return s;
                    });
                }
            });
        }
        return itemListContainer;
    }

    renderItem(feed: J.RssFeed, feedSrc: string, itemListContainer: Comp, state: AppState) {
        let feedOut: Comp[] = [];
        // console.log("FEED: " + S.util.prettyPrint(feed));

        let feedSrcHash = S.util.hashOfString(feedSrc);
        let page: number = state.feedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }

        itemListContainer.safeGetChildren().push(new Checkbox("Headlines Only", {
            className: "float-right"
        }, {
            setValue: (checked: boolean): void => {
                dispatch("Action_SetHealinesFlag", (s: AppState): AppState => {
                    S.edit.setRssHeadlinesOnly(s, checked);
                    return s;
                });
            },
            getValue: (): boolean => {
                return state.userPreferences.rssHeadlinesOnly;
            }
        }));

        itemListContainer.safeGetChildren().push(this.makeNavButtonBar(page, feedSrcHash, state));

        /* Main Feed Image */
        if (feed.image) {
            feedOut.push(new Img(null, {
                className: "rss-feed-image",
                src: feed.image
                // title: feed.image.title // todo-0: add this back.
                // align: "left" // causes text to flow around
            }));
        }

        /* Main Feed Title */
        if (feed.title) {
            if (feed.link) {
                feedOut.push(new Anchor(feed.link, feed.title, {
                    style: { fontSize: "45px" },
                    target: "_blank"
                }));
            }
            else {
                feedOut.push(new Span(feed.title, {
                    style: { fontSize: "45px" }
                }));
            }
        }

        feedOut.push(new Div(null, { className: "clearBoth" }));

        if (feed.description) {
            feedOut.push(new Html(feed.description));
        }

        // A bit of a hack to avoid showing the feed URL of our own aggregate feeds. We could publish this but no need to and
        // is even undesirable for now. Also the newline check is to not show the feed urls if this is a multi RSS feed one
        if (feedSrc.indexOf("/multiRss?id=") === -1 && feedSrc.indexOf("\n") === -1) {
            feedOut.push(new Div(feedSrc));
        }

        // todo-0: add back
        // if (feed.creator) {
        //     feedOut.push(new Div(feed.creator));
        // }

        let feedOutDiv = new Div(null, { className: "marginBottom" }, feedOut);
        itemListContainer.safeGetChildren().push(feedOutDiv);

        for (let item of feed.entries) {
            // console.log("FEED ITEM: " + S.util.prettyPrint(item));
            itemListContainer.safeGetChildren().push(this.buildFeedItem(feed, item, state));
        }

        itemListContainer.safeGetChildren().push(this.makeNavButtonBar(page, feedSrcHash, state));
    }

    makeNavButtonBar = (page: number, feedSrcHash: string, state: AppState): ButtonBar => {
        return new ButtonBar([
            page > 2 ? new IconButton("fa-angle-double-left", null, {
                onClick: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.setPage(feedSrcHash, state, 1);
                },
                title: "First Page"
            }) : null,
            page > 1 ? new IconButton("fa-angle-left", null, {
                onClick: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrcHash, state, -1);
                },
                title: "Previous Page"
            }) : null,
            new IconButton("fa-angle-right", "More", {
                onClick: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrcHash, state, 1);
                },
                title: "Next Page"
            })
        ], "text-center marginTop marginBottom");
    }

    /* cleverly does both prev or next paging */
    pageBump = (feedSrcHash: string, state: AppState, bump: number) => {
        let page: number = state.feedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }
        if (page + bump < 1) return;
        this.setPage(feedSrcHash, state, page + bump);
    }

    setPage = (feedSrcHash: string, state: AppState, page: number) => {
        dispatch("Action_RSSUpdated", (s: AppState): AppState => {
            // deleting will force a requery from the server
            delete s.feedCache[feedSrcHash];
            s.feedPage[feedSrcHash] = page;
            return s;
        });
    }

    buildFeedItem(feed: J.RssFeed, entry: J.RssFeedEntry, state: AppState): Comp {
        // console.log("ENTRY: " + S.util.prettyPrint(entry));
        let children: Comp[] = [];
        let headerDivChildren = [];

        /* todo-1: Sometimes entry.category can be an Object (not a String) here which will
        make React fail badly and render the entire page blank,
        blowing up the hole app, so we need probably validate EVERY
        property on entry with 'instanceof' like we're doing here to protect
        against that kind of chaos */
        // if (entry.category instanceof Object) {
        //     // todo-1: put this kind of typeof in "S.util.isString"
        //     if (entry.category.$ && (typeof entry.category.$.term === "string")) {
        //         // Some feeds have the category text buried under "$.term" so we just fix that here. This is a quick fix
        //         // only applicable to one feed afaik, and I'm not going to dig deeper into why we got this scenario (for now)
        //         entry.category = entry.category.$.term;
        //     }
        // }
        // if ((typeof entry.category === "string")) {
        //     headerDivChildren.push(new Div(entry.category));
        // }

        let playAudioFunc: Function = null;

        // todo-0: change to arrays to handle multiples of these types
        let audioEnclosure: J.RssFeedEnclosure = null;
        let imageEnclosure: J.RssFeedEnclosure = null;

        if (entry.enclosures) {
            entry.enclosures.forEach(enc => {
                if (enc.type && enc.type.indexOf("audio/") !== -1) {
                    audioEnclosure = enc;
                    playAudioFunc = () => {
                        let dlg = new AudioPlayerDlg(feed.title, entry.title, null, enc.url, 0, state);
                        dlg.open();
                    };
                }
                else if (enc.type && enc.type.indexOf("image/") !== -1) {
                    imageEnclosure = enc;
                }
            });
        }

        let shortTitle = null;
        let feedTitle = null;
        if (entry.title) {
            /* If we are rendering a multiple RSS feed thing here then the title will have two parts here
                that the server will have created using the "::" delimiter so we can use the left side of the
                delimted string to extract a designation of which feed this item is from since they will all be
                mixed and interwoven together from multiple sources based on the timestamp ordering (rev chron)
                */
            // todo-0: with new architecture this "::" hack can go away now!!
            let colonIdx = entry.title.indexOf(" :: ");
            if (colonIdx !== -1) {
                feedTitle = entry.title.substring(0, colonIdx);
                let headerAttribs: any = {
                    dangerouslySetInnerHTML: { __html: feedTitle }
                };
                headerDivChildren.push(new Heading(5, null, headerAttribs));

                shortTitle = entry.title.substring(colonIdx + 4);
                let anchorAttribs: any = {
                    className: "rssAnchor",
                    target: "_blank",
                    dangerouslySetInnerHTML: { __html: shortTitle }
                };

                if (!entry.link && playAudioFunc) {
                    anchorAttribs.onClick = playAudioFunc;
                }

                headerDivChildren.push(new Div(null, { className: "marginBottom" }, [
                    new Anchor(entry.link, null, anchorAttribs)
                ]));
            }
            else {
                shortTitle = entry.title;

                let anchorAttribs: any = {
                    className: "rssAnchor marginBottom",
                    target: "_blank",
                    dangerouslySetInnerHTML: { __html: entry.title }
                };

                // If the entry.link is not given we default a click on it, to just play the audio.
                if (!entry.link && playAudioFunc) {
                    anchorAttribs.onClick = playAudioFunc;
                }

                headerDivChildren.push(new Div(null, { className: "marginBottom" }, [
                    new Anchor(entry.link, null, anchorAttribs)
                ]));
            }
        }

        children.push(new Div(null, null, headerDivChildren));

        if (playAudioFunc) {
            let downloadLink = new Anchor(audioEnclosure.url, "[ Download " + audioEnclosure.type + " ]", { className: "rssDownloadLink" }, null, true);
            let audioButton = new Button("Play Audio", playAudioFunc, null, "btn-primary");
            children.push(new ButtonBar([audioButton, downloadLink], null, "rssMediaButtons"));
        }

        children.push(new Div(null, { className: "clearBoth" }));

        if (imageEnclosure) {
            children.push(new Img(null, {
                className: "rss-feed-image",
                src: imageEnclosure.url
            }));
        }

        if (entry.thumbnail) {
            children.push(new Img(null, {
                className: "rss-feed-image",
                src: entry.thumbnail
            }));
        }

        if (!state.userPreferences.rssHeadlinesOnly) {
            if (entry.description) {
                children.push(new Html(entry.description));
            }
        }

        let dateStr = ""; // entry.pubDate; //todo-0: fix
        // if (entry.isoDate) {
        //     let date = Date.parse(entry.isoDate);
        //     if (date) {
        //         dateStr = S.util.formatDateShort(new Date(date));
        //     }
        // }

        let linkIcon = new Icon({
            className: "fa fa-link fa-lg rssLinkIcon",
            title: "Copy RSS Item URL into clipboard",
            onClick: () => {
                S.util.copyToClipboard(entry.link);
                S.util.flashMessage("Copied to Clipboard: " + entry.link, "Clipboard", true);
            }
        });

        let postIcon = !state.isAnonUser ? new Icon({
            className: "fa fa-comment fa-lg rssPostIcon",
            title: "Post a comment about this Article/Link",
            onClick: () => {
                S.edit.addNode(null, entry.title + "\n\n" + entry.link, state);
            }
        }) : null;

        let bookmarkIcon = !state.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg rssLinkIcon",
            title: "Bookmark this RSS entry",
            onClick: () => {
                // Now that we have "Open Graph" we don't
                // need the content. User can still enter it at will.
                // let content = "#### " + shortTitle + "\n";
                // if (feedTitle) {
                //     content += "\nFeed: " + feedTitle + "\n";
                // }
                // content += "\n" + entry.link;
                S.edit.addLinkBookmark(entry.link, state);
            }
        }) : null;

        let footerSpan = new Span(dateStr, { className: "marginRight" });

        children.push(new Div(null, { className: "float-right" }, [
            footerSpan, postIcon, linkIcon, bookmarkIcon
        ]));

        children.push(new Clearfix());

        return new Div(null, { className: "rss-feed-item" }, children);
    }

    /* This will process all the images loaded by the RSS Feed content to make sure they're all 300px wide because
    otherwise we get rediculously large images */
    getDomPreUpdateFunction(parent: CompIntf): void {
        const urlSet: Set<string> = new Set<string>();

        S.util.forEachElmBySel("#" + parent.getId() + " .rss-feed-listing img", (el: HTMLElement, i) => {

            /* Because some feeds use the same image in the header and content we try to detect that here
            and remove any but the first ocurrance of any given image on the entier page */
            let src: string = (el as any).src;
            if (urlSet.has(src)) {
                el.style.display = "none";
                return;
            }

            el.removeAttribute("align");

            // use 'block' here to stop any text from being crammed down the right side of the page
            // where there might not be enough space.
            el.style.display = "block";

            urlSet.add(src);

            // console.log("IMG SRC: " + (el as any).src);
            el.style.borderRadius = ".6em";
            el.style.border = "1px solid gray";
            el.style.marginBottom = "12px";

            /* Setting width to 100% and always removing height ensures the image does fit into our colum display
            and also will not stretch */
            el.style.maxWidth = "100%";
            delete el.style.width;
            el.removeAttribute("height");
        });

        // S.util.forEachElmBySel("#" + parent.getId() + " .rss-feed-image", (el, i) => {
        //     el.style.maxWidth = "40%";
        // });
    }
}
