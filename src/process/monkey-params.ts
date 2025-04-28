import { Window } from "node-window-manager";
import { IPCSource, } from "@nexus/nexus-module-builder"


export interface MonkeyParams {
    sourceModule: IPCSource;
    appName: string;
    exePath: string;
    closeOnExit: boolean;
    isShown: boolean;
    filter: Filter;
    callback?: ((event: MonkeyEvents) => void) | undefined
}

export type Filter = (window: Window) => boolean;

export type MonkeyEvents =
    "found-window" |
    "show" |
    "hide" |
    "lost-window"
