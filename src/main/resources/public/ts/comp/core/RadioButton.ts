import { createElement, ReactNode } from "react";
import { ValueIntf } from "../../Interfaces";
import { Comp } from "../base/Comp";

/* I never got state management working with this radio button properly.

UPDATE: I did change the the 'attribs.checked' to 'attribs.defaultChecked' and I think that may
have fixed the issues I was having so that if i try again to get the state (this.state) stuff working
it might finally work now.
*/
export class RadioButton extends Comp {

    constructor(public label: string, public checked: boolean, groupName: string, _attribs: any, private valueIntf: ValueIntf) {
        super(_attribs);

        this.attribs.onChange = (evt: any) => {
            this.updateValFunc(evt.target.checked);
        };

        this.attribs.name = groupName;
        this.attribs.type = "radio";
        this.attribs.label = label;
        this.attribs.value = "val-" + this.getId();
        this.attribs.className = "form-check-input";
    }

    // Handler to update state
    updateValFunc(value: boolean): void {
        if (value !== this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);

            // needing this line took a while to figure out. If nothing is setting any actual detectable state change
            // during his call we have to do this here.
            this.forceRender();
        }
    }

    setChecked(val: boolean): void {
        this.valueIntf.setValue(val);
    }

    getChecked(): boolean {
        return this.valueIntf.getValue();
    }

    compRender(): ReactNode {
        this.attribs.checked = !!this.valueIntf.getValue();

        let attribsClone = { ...this.attribs };
        delete attribsClone.ref;

        return createElement("span", {
            key: this.attribs.id + "_span",
            className: "form-check",
            ref: this.attribs.ref
        },
            createElement("input", attribsClone),
            createElement("label", {
                key: this.attribs.id + "_label",
                htmlFor: this.attribs.id,
                className: "form-check-label radioLabel"
            }, this.label || ""));
    }
}
