import { useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { CompIntf } from "./base/CompIntf";
import { Icon } from "./core/Icon";

export class BreadcrumbsPanel extends Div {
    constructor() {
        super(null, {
            className: "breadcrumbPanel"
        });
    }

    preRender(): void {
        const state = useAppState();
        this.setChildren([this.createBreadcrumbs(state)]);
    }

    createBreadcrumbs = (state: AppState): Comp => {
        let children: CompIntf[] = [];

        if (state.breadcrumbs?.length > 0) {
            children = state.breadcrumbs.map(bc => {
                if (bc.id === state.node.id) {
                    // ignore root node or page root node. we don't need it.
                    return null;
                }
                else if (bc.id) {
                    if (!bc.name) {
                        const type = S.plugin.getType(bc.type);
                        bc.name = type ? type.getName() : "???";
                    }

                    return new Span(S.util.removeHtmlTags(bc.name), {
                        onClick: () => S.view.jumpToId(bc.id),
                        className: "breadcrumbItem"
                    });
                }
                else {
                    return new Span("...", { className: "marginRight" });
                }
            }).filter(c => !!c);
        }

        if (children.length > 0 && !state.userPrefs.showParents) {
            children.push(new Icon({
                className: "fa fa-level-down fa-lg showParentsIcon",
                title: "Toggle: Show Parent on page",
                onClick: () => S.edit.toggleShowParents(state)
            }));
        }

        return new Div(null, null, children);
    }
}
