import { Window } from "node-window-manager";
import { IPCSource, } from "@nexus/nexus-module-builder"


export interface MonkeyParams {
    sourceModule: IPCSource;
    appName: string;
    exePath: string;
    filter: Filter;
    closeOnExit: boolean;
    isShown: boolean;
}

export type Filter = (window: Window) => boolean;
