import * as I from "../Interfaces";

export interface EditIntf {
    importTargetNode: any;
    showReadOnlyProperties: boolean;
    nodesToMove: any;
    nodesToMoveSet: Object;
    parentOfNewNode: I.NodeInfo;
    nodeInsertTarget: any;

    createNode(): void;
    splitNode(splitType: string): void;
    openChangePasswordDlg(): void;
    openManageAccountDlg(): void;
    editPreferences(): void;
    openImportDlg(): void;
    openExportDlg(): void;
    isEditAllowed(node: any): boolean;
    isInsertAllowed(node: any): boolean;
    startEditingNewNode(typeName?: string, createAtTop?: boolean): void;
    insertNodeResponse(res: I.InsertNodeResponse): void;
    createSubNodeResponse(res: I.CreateSubNodeResponse): void;
    saveNodeResponse(res: I.SaveNodeResponse, payload: any): void;
    editMode(modeVal?: boolean): void;
    moveNodeUp(id?: string): void;
    moveNodeDown(id?: string): void;
    moveNodeToTop(id?: string): void;
    moveNodeToBottom(id?: string): void;
    getNodeAbove(node: I.NodeInfo): any;
    getNodeBelow(node: I.NodeInfo): I.NodeInfo;
    getFirstChildNode(): any;
    runEditNode(id: any): void;
    insertNode(id?: any, typeName?: string): void;
    createSubNode(id?: any, typeName?: string, createAtTop?: boolean): void;
    clearSelections(): void;
    selectAllNodes() : void;
    deleteSelNodes(selNodesArray : string[]): void;
    getBestPostDeleteSelNode(): I.NodeInfo;
    cutSelNodes(): void;
    undoCutSelNodes(): void;
    pasteSelNodes(location: string): void;
    insertBookWarAndPeace(): void;
}

