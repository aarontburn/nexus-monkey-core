import { Window } from "node-window-manager";
import { IPCSource, } from "@nexus-app/nexus-module-builder"
import { Rectangle } from "electron";


export interface MonkeyParams {
    sourceModule: IPCSource;
    appName: string;
    exePath: string;
    windowPath?: string;
    filter: Filter;
    onEvent?: ((event: MonkeyEvents) => void) | undefined,
    options?: {
        closeOnExit?: boolean;
        isCurrentlyShown?: boolean;
        locateOnStartup?: boolean;
        openOnStartup?: boolean;
        offset?: Partial<Rectangle>;
    }
}

export const defaultOptions = {
    isCurrentlyShown: false,
    locateOnStartup: false,
    openOnStartup: false,
    offset: { x: 0, y: 0, width: 0, height: 0 },
}

export type Filter = (window: Window) => boolean;

export type MonkeyEvents =
    "found-window" |
    "show" |
    "hide" |
    "lost-window"
