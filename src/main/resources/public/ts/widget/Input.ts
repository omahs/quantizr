import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { State } from "../State";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* Can this be combined with textarea? making of course the tag naem itself a variable ? */
export class Input extends Comp {

    constructor(attribs: Object = {}, s?: State<any>) {
        super(attribs, s);
        this.attribs.onChange = (evt) => {
            this.mergeState({ value: evt.target.value });
        };
    }

    compRender(): ReactNode {
        this.attribs.value = this.getState().value;
        return S.e("input", this.attribs);
    }
}
