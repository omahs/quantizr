import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Checkbox } from "../comp/Checkbox";
import { Form } from "../comp/Form";
import { HorizontalLayout } from "../comp/HorizontalLayout";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PrefsDlg extends DialogBase {

    constructor(state: AppState) {
        super("Preferences", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    new Checkbox("Show Node Metadata", null, {
                        setValue: (checked: boolean): void => {
                            this.appState.userPreferences.showMetaData = checked;
                        },
                        getValue: (): boolean => {
                            return this.appState.userPreferences.showMetaData;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Save", this.savePreferences, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    savePreferences = async (): Promise<void> => {
        if (!this.appState.isAnonUser) {
            let res: J.SaveUserPreferencesResponse = await S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userPreferences: {
                    editMode: this.appState.userPreferences.editMode,
                    showMetaData: this.appState.userPreferences.showMetaData,
                    rssHeadlinesOnly: this.appState.userPreferences.rssHeadlinesOnly,
                    mainPanelCols: this.appState.userPreferences.mainPanelCols,
                    maxUploadFileSize: -1,
                    enableIPSM: false // we never need to enable this here. Only the menu can trigger it to set for now.
                }
            });
            this.savePreferencesResponse(res);
        }
        this.close();
    }

    savePreferencesResponse = (res: J.SaveUserPreferencesResponse): void => {
        if (S.util.checkSuccess("Saving Preferences", res)) {
            S.quanta.refresh(this.appState);
        }
    }
}
