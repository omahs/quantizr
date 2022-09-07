import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class CommentTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.COMMENT, "Comment", "fa-comment", true);
    }

    // For now i'm not sure how we should indicate visibly that a
    // node is a comment, so I'm just not doing it, but this code DOES work.
    // getExtraMarkdownClass(): string {
    //     return "commentMarkdownClass";
    // }
}
