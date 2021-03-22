import { createStore } from "redux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { AppAction } from "./Interfaces";
import { Log } from "./Log";
import { PubSub } from "./PubSub";
import { useSelector } from "react-redux";

export const initialState = new AppState();

/**
 * Takes a state as input, does the action on it, and returns the resulting new state.
 */
export function rootReducer(state: AppState = initialState, /* action: Action<any> */ action: AppAction) {

    if (!state) {
        console.error("rootReducer called with null state: " + action);
        return null;
    }

    // console.log("Action: " + action.type);
    if (action.update) {
        state = action.update(state);
    }

    return state;
}

export const store = createStore(rootReducer);

/* For syntactical sugar we allow a state to get passed or not */
export const appState = (state?: AppState): AppState => {
    return state || store.getState();
};

export const useAppState = (state?: AppState): AppState => {
    return state || useSelector((s: AppState) => s);
};

export const dispatch = (action: AppAction) => {
    PubSub.pub(C.PUBSUB_ClearComponentCache);

    // Log.log("Dispatch Running: " + action.type);
    store.dispatch(action);
    // Log.log("Dispatch Complete: " + action.type);
};

/* This is MUCH faster, for when structural changes won't happen (only style changes for example),
becuase it doesn't reset static objects to null, meaning they get reused, without reconstructing */
export const fastDispatch = (action: AppAction) => {
    store.dispatch(action);
    // console.log("Fast Dispatch Complete: " + action.type);
};

/* This listener is temporary until I find a better way to do this code, which needs to always run after any
render is complete and AFTER the html DOM is updated/final

This works, but is currently not needed.
*/
const handleChange = () => {
    // console.log("AppRedux change.");
};

store.subscribe(handleChange);
// const unsubscribe = store.subscribe(handleChange);
// unsubscribe()
