import { Window } from "node-window-manager";
import { IPCSource, } from "@nexus-app/nexus-module-builder"


export interface MonkeyParams {
    sourceModule: IPCSource;
    appName: string;
    exePath: string;
    closeOnExit: boolean;
    isShown: boolean;
    locateOnStartup?: boolean | undefined;
    filter: Filter;
    callback?: ((event: MonkeyEvents) => void) | undefined
}

export type Filter = (window: Window) => boolean;

export type MonkeyEvents =
    "found-window" |
    "show" |
    "hide" |
    "lost-window"
