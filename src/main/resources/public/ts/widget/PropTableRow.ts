import { Comp } from "./base/Comp";
import { PropTableCell } from "./PropTableCell";
import * as I from "../Interfaces";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PropTableRow extends Comp {

    propEntry: I.PropEntry;

    constructor(attribs: Object = {}, initialChildren: PropTableCell[] = null) {
        super(attribs);
        //(<any>this.attribs).style = "display: table-row;";
        //(<any>this.attribs).sourceClass = "EditPropsTableRow";
        this.setChildren(initialChildren);
    }

    compRender = (p: any): ReactNode => {
        return this.tagRender('tr', null, p);
    }
}
