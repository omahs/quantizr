import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PropTable extends Comp {

    constructor(attribs : Object = {}) {
        super(attribs);
        //(<any>this.attribs).style = "display:table; width:100%;";
        //(<any>this.attribs).sourceClass = "EditPropsTable";
    }

    compRender = (p: any): ReactNode => {
        return this.tagRender('table', null, p);
    }
}

