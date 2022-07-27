import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class ImportCryptoKeyDlg extends DialogBase {
    keyState: ValidatedState<any> = new ValidatedState<any>();

    constructor() {
        super("Import Key Pair", "app-modal-content-medium-width", false);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("Enter JWK Key Text"),
                new TextArea("Keys", { rows: 15 }, this.keyState),
                new ButtonBar([
                    new Button("Import", this.import, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    import = async () => {
        // until better validation, just check for empty
        let keyText = this.keyState.getValue();
        if (!keyText) {
            S.util.showMessage("Enter key text.", "Warning");
            return;
        }
        let success = await S.encryption.importKeyPair(keyText);
        if (!success) {
            S.util.showMessage("Invalid key text", "Warning");
            return;
        }
        this.close();
    }
}
