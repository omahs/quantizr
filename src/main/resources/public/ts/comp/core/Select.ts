import { ReactNode } from "react";
import { ValueIntf } from "../../Interfaces";
import { Comp } from "../base/Comp";
import { SelectionOption } from "./SelectionOption";

interface LS { // Local State
    value: string
}

export class Select extends Comp {
    constructor(attribs: any, public selectionOptions: Object[], private valueIntf: ValueIntf) {
        super(attribs);
        this.mergeState({ value: valueIntf.getValue() });
    }

    compRender = (): ReactNode => {
        this.setChildren(this.selectionOptions.map((row: any) => {
            return new SelectionOption(row.key, row.val);
        }));

        this.attribs.onChange = (evt: any) => {
            this.valueIntf.setValue(evt.target.value);
            this.mergeState({ value: evt.target.value });
        };

        this.attribs.value = this.getState<LS>().value;
        return this.tag("select");
    }
}