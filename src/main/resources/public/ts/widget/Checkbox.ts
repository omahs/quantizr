import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants } from "../Constants";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Checkbox extends Comp {

    constructor(public label: string = null, checked: boolean = false, _attribs: Object = null) {
        super(_attribs); 
        this.attribs.key = this.attribs.id;

        if (checked) {
            this.attribs.defaultChecked = "checked";
            this.setChecked(true);
        }
    
        this.attribs.type = "checkbox";
        this.attribs.className = "checkbox-indicator";
    }

    setChecked(checked: boolean) {
        S.dom.whenElm(this.getId(), (elm) => {
            (<any>elm).checked = checked;
        });
    }

    getChecked(): boolean {
        let elm: HTMLElement = S.util.domElm(this.getId());
        return elm && (<any>elm).checked;
    }

    compRender = (p: any): ReactNode  => {
        if (this.label) {
            return S.e('span', { key: p.id + "_span" }, S.e('input', p), 
            S.e('label', { 
                key: p.id + "_label", 
                className: "checkbox-label",
                htmlFor: p.id 
            }, this.label));
        }
        else {
            return S.e('span', { key: p.id + "_span" }, S.e('input', p));
        }
    }
}
