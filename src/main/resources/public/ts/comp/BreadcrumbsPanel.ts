import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Icon } from "./core/Icon";

export class BreadcrumbsPanel extends Div {
    constructor() {
        super(null, {
            className: "breadcrumbPanel"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.setChildren([
            this.createBreadcrumbs(state)
        ]);
    }

    createBreadcrumbs = (state: AppState): Comp => {
        let children = [];

        if (state.breadcrumbs?.length > 0) {
            state.breadcrumbs.forEach(bc => {
                if (bc.id === state.node.id) {
                    // ignore root node or page root node. we don't need it.
                }
                else if (bc.id) {
                    if (!bc.name) {
                        const typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(bc.type);
                        if (typeHandler) {
                            bc.name = typeHandler.getName();
                        }
                        else {
                            bc.name = "???";
                        }
                    }

                    let name = S.util.removeHtmlTags(bc.name);

                    children.push(new Span(name, {
                        onClick: () => S.view.jumpToId(bc.id),
                        className: "breadcrumbItem"
                    }));
                }
                else {
                    children.push(new Span("...", { className: "marginRight" }));
                }
            });
        }

        if (children.length > 0 && !state.userPreferences.showParents) {
            children.push(new Icon({
                className: "fa fa-level-down fa-lg showParentsIcon",
                title: "Toggle: Show Parent on page",
                onClick: () => S.edit.toggleShowParents(state)
            }));
        }

        return new Div(null, null, children);
    }
}
