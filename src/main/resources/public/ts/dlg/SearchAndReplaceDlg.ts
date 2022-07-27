import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Form } from "../comp/core/Form";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

interface LS { // Local State
    recursive: boolean;
}

export class SearchAndReplaceDlg extends DialogBase {

    searchState: ValidatedState<any> = new ValidatedState<any>();
    replaceState: ValidatedState<any> = new ValidatedState<any>();

    constructor() {
        super("Search and Replace", "app-modal-content-narrow-width", false);
        this.mergeState<LS>({ recursive: true });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField({ label: "Search for", val: this.searchState }),
                new TextField({ label: "Replace with", val: this.replaceState }),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => {
                            this.mergeState<LS>({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Replace", this.replace, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.searchState.getValue()) {
            this.searchState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.searchState.setError(null);
        }

        if (!this.replaceState.getValue()) {
            this.replaceState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.replaceState.setError(null);
        }

        return valid;
    }

    replace = () => {
        if (!this.validate()) {
            return;
        }

        let node: J.NodeInfo = S.nodeUtil.getHighlightedNode(getAppState());
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.srch.searchAndReplace(this.getState<LS>().recursive, node.id, this.searchState.getValue(), this.replaceState.getValue(), getAppState());
        this.close();
    }
}
