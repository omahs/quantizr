import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { TabIntf } from "./TabIntf";
import { EditorOptions } from "../Interfaces";

/* This interface is how Type Plugins are handled */
export interface TypeIntf {
    getTypeName(): string;
    getName(): string;
    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp;
    getIconClass(): string;
    allowAction(action : NodeActionType, node: J.NodeInfo, ast: AppState): boolean;
    getAllowRowHeader(): boolean;
    allowPropertyEdit(typeName: string, ast: AppState): boolean;
    domPreUpdateFunction(parent: CompIntf): void;

    // if this returns a list of props, then these props are all the EditNodeDlg is allowed to show AND
    // they will all be put outside the collapsible panel if they'd normally be inside he collapse panel
    getCustomProperties(): string[];
    ensureDefaultProperties(node: J.NodeInfo): void;
    getAllowPropertyAdd(): boolean;
    getAllowContentEdit(): boolean;
    getEditLabelForProp(propName: string): string;
    getEditorRowsForProp(propName: string): number;
    getAllowUserSelect(): boolean;
    hasCustomProp(prop: string): boolean;
    hasSelectableProp(prop: string): boolean;
    getEditorHelp(): string;
    isSpecialAccountNode(): boolean;

    // for sorting on client side (namely for items packaged in a collapsable panel on account root page.)
    subOrdinal(): number;
    renderEditorSubPanel(node: J.NodeInfo): Comp;

    // todo-1: now that we have EditorOptions, many of the fixed values can be subsumed into it to simplify
    // this interface
    getEditorOptions(): EditorOptions;
}

export enum NodeActionType {
    /* eslint-disable no-unused-vars */
    addChild, editNode, insert, upload, delete, share
};
