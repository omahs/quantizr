import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { runClassDemoTest } from "../ClassDemoTest";
import { Comp } from "./base/Comp";
import { Button } from "../comp/core/Button";
import { CompDemo } from "../comp/CompDemo";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";

export class AppDemo extends Div {

    constructor() {
        super();
        runClassDemoTest();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.setChildren([
            new HorizontalLayout([
                new Button("Inc AppState.counter=" + state.counter + " compDemoIdActive=" + state.compDemoIdActive, () => {
                    Comp.renderCounter = 0;
                    dispatch("Action_DemoAppIncCounter", (s: AppState): AppState => {
                        s.counter++;
                        return s;
                    });
                })
            ]),

            new HorizontalLayout([
                new CompDemo()
            ])
        ]);
    }
}
