import { DataResponse, HTTPStatusCodes, IPCSource, Process } from "@nexus-app/nexus-module-builder"
import Monkey from "./monkey";
import { MonkeyParams } from "./monkey-params";
import { windowManager } from "node-window-manager";


// These is replaced to the ID specified in export-config.js during export. DO NOT MODIFY.
const MODULE_ID: string = "{EXPORTED_MODULE_ID}";
const MODULE_NAME: string = "{EXPORTED_MODULE_NAME}";
// ---------------------------------------------------

export default class MonkeyCoreProcess extends Process {

    private monkeyMap: { [source: string]: Monkey } = {};


    public constructor() {
        super({
            moduleID: MODULE_ID,
            moduleName: MODULE_NAME
        });
    }

    public async initialize(): Promise<void> {
        await super.initialize();

        console.info(`🐒 Monkey Core initialized.`);

        await this.requestExternal("aarontburn.Debug_Console", "addCommandPrefix", {
            prefix: "all-windows",
            documentation: {
                shortDescription: "Prints out the path (and count) of all active windows."
            },
            executeCommand: (args: string): void => {
                const paths: string[] = windowManager.getWindows().map(window => window.path);
                const map: { [path: string]: number } = {};

                for (const path of paths) {
                    map[path] = (map[path] ?? 0) + 1
                }

                console.info(
                    Object.keys(map)
                        .map(path => path.replace(/\\/g, '/') + ` (${map[path]})`)
                        .reduce((acc, path) => acc + `\t${path}\n`, '\n')
                );
            }
        })
    }

    public async onExit(): Promise<void> {
        for (const monkey of Object.values(this.monkeyMap)) {
            monkey.appWindow?.setOwner(null);
            monkey.show();
        }
    }

    private isValidParams(obj: any): obj is MonkeyParams {
        if (typeof obj.locateOnStartup !== 'boolean') { // undefined or invalid 
            obj.locateOnStartup = true;
        }

        return typeof obj === 'object' &&
            obj !== null &&
            typeof obj.appName === 'string' &&
            typeof obj.exePath === 'string' &&
            typeof obj.closeOnExit === 'boolean' &&
            typeof obj.isShown === 'boolean' &&
            typeof obj.locateOnStartup === 'boolean' &&
            typeof obj.filter === 'function' &&
            (typeof obj.callback === 'undefined' || typeof obj.callback === 'function')

    }

    public async handleExternal(source: IPCSource, eventType: string, data: any[]): Promise<DataResponse> {
        switch (eventType) {
            case "add-window": {
                if (!this.isValidParams(data[0])) {
                    return { body: undefined, code: HTTPStatusCodes.BAD_REQUEST }
                }

                const params: MonkeyParams = { ...(data[0]), sourceModule: source };
                this.monkeyMap[source.getIPCSource()]?.cleanup();
                this.monkeyMap[source.getIPCSource()] = new Monkey(this, params);

                return { body: undefined, code: HTTPStatusCodes.OK }
            }
            case "show": {
                this.monkeyMap[source.getIPCSource()]?.show();
                return { body: undefined, code: HTTPStatusCodes.OK }
            }

            case "hide": {
                this.monkeyMap[source.getIPCSource()]?.hide();
                return { body: undefined, code: HTTPStatusCodes.OK }
            }

            case "detach": {
                this.monkeyMap[source.getIPCSource()]?.detach();

                break;
            }

            case "reattach": {
                this.monkeyMap[source.getIPCSource()]?.reattach();

                break;
            }

            case "wait-for-window": {
                this.monkeyMap[source.getIPCSource()]?.waitForWindow();

                break;
            }


            default: {
                return { body: undefined, code: HTTPStatusCodes.NOT_IMPLEMENTED }
            }
        }



    }



}