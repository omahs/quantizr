import React from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";
import { toArray } from "react-emoji-render";

// https://github.com/mathjax/MathJax-demos-web
// https://github.com/mathjax/MathJax-node
//
// Supposedly mathjax-node should work, but I never got this import to
// compile without errors, so I just went back to loading MathJax from CDN
// as a script tag in the HTML.
//
// import { MathJax } from "mathjax-node";
// MathJax.config({
//     MathJax: {
//         tex: {
//             inlineMath: [['[math]', '[/math]']]
//         }
//     }
// });
// MathJax.start();

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var MathJax;

// see: https://www.npmjs.com/package/react-emoji-render
// https://codesandbox.io/s/xjpy58llxq

const parseEmojis = value => {
    const emojisArray = toArray(value);
    const newValue = emojisArray.reduce((previous: any, current: any) => {
        if (typeof current === "string") {
            return previous + current;
        }
        return previous + current.props.children;
    }, "");
    return newValue;
};

const parseEmojisAndHtml = value => {
    const emojisArray = toArray(value);
    const newValue = emojisArray.map((node: any) => {
        if (typeof node === "string") {
            return <span dangerouslySetInnerHTML={{ __html: node }} />;
        }
        return node.props.children;
    });
    return newValue;
};

export class Html extends Comp {

    constructor(content: string = "", attribs: Object = {}, initialChildren: CompIntf[] = null) {
        super(attribs);
        this.setChildren(initialChildren);
        this.setText(content);
    }

    setText = (content: string) => {
        this.mergeState({ content });
    }

    compRender(): React.ReactNode {
        if (this.getChildren() && this.getChildren().length > 0) {
            console.error("dangerouslySetInnerHTML component had children. This is a bug: id=" + this.getId() + " constructor.name=" + this.constructor.name);
        }

        // ************* DO NOT DELETE. Method 1 and 2 both work, except #2 would need to be updated to
        // enable the attribs!
        // METHOD 1:
        this.attribs.dangerouslySetInnerHTML = { __html: parseEmojis(this.getState().content) };
        return this.e("div", this.attribs);
        // METHOD 2:
        // return <div>{parseEmojisAndHtml(this.getState().content)}</div>;
    }

    /* We do two things in here:
    1) update formula rendering (MathJax), and
    2) change all "a" tags inside this div to have a target=_blank
    */
    domPreUpdateEvent = (): void => {
        this.whenElm((elm) => {
            if (MathJax && MathJax.typeset) {
                // note: MathJax.typesetPromise(), also exists
                MathJax.typeset([elm]);

                S.util.forEachElmBySel("#" + this.getId() + " a", (el, i) => {
                    let href = el.getAttribute("href");

                    // Detect this is a link to this instance we are being served from...
                    if (href && href.indexOf && (href.indexOf("/") === 0 || href.indexOf(window.location.origin) !== -1)) {
                        /* This code makes it where it where links to our own app that point to
                        specific named locations on the tree will NOT open in separate browser tab but
                        will open in the current browser tab as is the default without the 'target='
                        attribute on an anchor tag. */
                        if (href.indexOf("/app?id=:") !== -1 ||
                            href.indexOf("/app?id=~") !== -1 ||
                            href.indexOf("/app?tab=") !== -1) {
                            return;
                        }
                    }
                    el.setAttribute("target", "_blank");
                });
            }
        });
    }
}