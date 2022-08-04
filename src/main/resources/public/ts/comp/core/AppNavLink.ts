import { ReactNode } from "react";
import { getAppState } from "../../AppRedux";
import { Constants as C } from "../../Constants";
import { PubSub } from "../../PubSub";
import { Comp } from "../base/Comp";

export class AppNavLink extends Comp {
    constructor(private content: string = "", func: Function) {
        super(null);
        this.attribs.className = getAppState().mobileMode ? "tabSubOptionsItemMobile" : "tabSubOptionsItem";
        this.attribs.onClick = () => {
            PubSub.pub(C.PUBSUB_closeNavPanel);
            func();
        }
    }

    compRender = (): ReactNode => {
        return this.tag("div", null, this.getChildrenWithFirst(this.content));
    }
}