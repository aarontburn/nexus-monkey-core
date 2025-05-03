import MonkeyCoreProcess from "./main";
import { windowManager, Window } from "node-window-manager";

interface Command {
    prefix: string;
    executeCommand: (args: string[]) => void,
    documentation?: {
        shortDescription?: string;
        longDescription?: string;
    }
}

export const addCommands = (p: MonkeyCoreProcess) => {
    for (const command of getCommands()) {
        p.requestExternal("aarontburn.Debug_Console", "addCommandPrefix", command);
    }
}

let isListenerOn: boolean = false;
const listenerFunction = (window: Window) => {
    console.info(window.path)
}

const getCommands = (): Command[] => {
    return [
        {
            prefix: "windows",
            documentation: {
                shortDescription: "Prints the paths of all windows. If an index is provided, prints out the info about each window under that path."
            },
            executeCommand: (args: string[]): void => {
                if (args[1] === undefined) {
                    const paths: string[] = windowManager.getWindows().map(window => window.path);
                    const map: { [path: string]: number } = {};

                    for (const path of paths) {
                        map[path] = (map[path] ?? 0) + 1
                    }

                    console.info(
                        Object.keys(map)
                            .map((path: string, index: number) => `${index}: ${path.replace(/\\/g, '/')} (${map[path]})`)
                            .reduce((acc, path) => acc + `\t${path}\n`, '\n')
                    );
                    return;
                }

                const paths: { [path: string]: Window[] } =
                    windowManager.getWindows().reduce((map, window) => {
                        map[window.path] = (map[window.path] ?? [])
                        map[window.path].push(window)
                        return map
                    }, {} as { [path: string]: Window[] });

                const windows: Window[] = paths[Object.keys(paths)[parseInt(args[1])]]

                const outs = windows.map(window => {
                    const out: string[] = [];
                    out.push('\t' + (window.getTitle() ? window.getTitle() : '<No title>'))
                    out.push("\t\tBounds: " + JSON.stringify(window.getBounds()))
                    out.push("\t\tPID: " + window.processId)
                    return out.join("\n");
                })

                console.log(`\n${windows[0].path}\n${outs.join('\n')}\n`);
            }
        },
        {
            prefix: "window-listen",
            documentation: {
                shortDescription: "Toggles the active window listener"
            },
            executeCommand: (args: string[]): void => {
                if (isListenerOn) {
                    console.info("Window listener turned ON");
                    windowManager.removeListener('window-activated', listenerFunction);
                } else {
                    console.info("Window listener turned OFF");
                    windowManager.addListener('window-activated', listenerFunction)
                }

                isListenerOn = !isListenerOn;
            }
        },
    ]
}