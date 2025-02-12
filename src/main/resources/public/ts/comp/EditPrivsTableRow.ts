import { Button } from "../comp/core//Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Span } from "../comp/core/Span";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Checkbox } from "./core/Checkbox";
import { Icon } from "./core/Icon";
import { ListBoxRow } from "./ListBoxRow";

export class EditPrivsTableRow extends ListBoxRow {

    constructor(private shareNodeToUserFunc: Function, public aclEntry: J.AccessControlInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
    }

    renderAclPrivileges(aclEntry: J.AccessControlInfo): Div {
        const writable = S.props.hasPrivilege(this.aclEntry, J.PrivilegeType.WRITE);
        const div = new Div(null, { className: "float-end tinyMarginAll" });

        aclEntry.privileges.forEach(privilege => {
            div.addChild(
                new Div(null, null, [
                    // new Span(privilege.privilegeName), don't need this it's just "rd/wr"
                    new ButtonBar([
                        new Checkbox("Allow Replies", { className: "marginRight" }, {
                            setValue: (checked: boolean) => this.shareNodeToUserFunc(this.aclEntry.principalName, checked),
                            getValue: (): boolean => writable
                        }),
                        new Button("Remove", () => {
                            this.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
                        })
                    ], "marginLeft")
                ])
            );
        });
        return div;
    }

    preRender(): void {
        let src: string = null;
        if (this.aclEntry.avatarVer) {
            src = S.render.getAvatarImgUrl(this.aclEntry.principalNodeId, this.aclEntry.avatarVer);
        }
        // foreign users have this kind of avatar
        else if (this.aclEntry.foreignAvatarUrl) {
            src = this.aclEntry.foreignAvatarUrl;
        }

        let img: Div = null;
        if (src) {
            img = new Div(null, { className: "friendListImgDiv" }, [
                new Img({
                    className: "friendListImage",
                    src,
                    onClick: () => {
                        new UserProfileDlg(this.aclEntry.principalNodeId).open();
                    }
                })
            ]);
        }

        const displayName = this.aclEntry.displayName
            ? this.aclEntry.displayName + " (@" + this.aclEntry.principalName + ")"
            : ("@" + this.aclEntry.principalName);

        const isPublic = this.aclEntry.principalName === J.PrincipalName.PUBLIC;

        this.setChildren([
            new Div(null, null, [
                img,
                isPublic ? new Div(null, { className: "friendListImgDiv" }, [
                    new Icon({
                        className: "fa fa-globe fa-lg sharingIcon marginAll",
                        title: "Node is Public"
                    })
                ]) : null,
                isPublic ? new Span("Public (Everyone)", { className: "largeFont sharingDisplayName" })
                    : new Span(displayName, {
                        className: "sharingDisplayName",
                        onClick: () => {
                            new UserProfileDlg(this.aclEntry.principalNodeId).open();
                        }
                    }),
                this.renderAclPrivileges(this.aclEntry)
            ])
        ]);
    }
}
