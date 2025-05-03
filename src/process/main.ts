import { DataResponse, HTTPStatusCodes, IPCSource, Process } from "@nexus-app/nexus-module-builder"
import Monkey from "./monkey";
import { defaultOptions, MonkeyParams } from "./monkey-params";
import { addCommands } from "./commands";


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

        addCommands(this)
    }

    public async onExit(): Promise<void> {
        for (const monkey of Object.values(this.monkeyMap)) {
            monkey.appWindow?.setOwner(null);
            monkey.show();
        }
    }

    private normalizeParams(obj: any): MonkeyParams | null {
        if (typeof obj !== 'object' || !obj) return null;

        const options =
            typeof obj.options === 'object'
                ? { ...defaultOptions, ...obj.options }
                : defaultOptions;

        if (
            typeof obj.appName !== 'string'
            || typeof obj.exePath !== 'string'
            || typeof obj.filter !== 'function') {
            return null;
        }

        if (obj.onEvent !== undefined && typeof obj.onEvent !== 'function') {
            return null;
        }

        return { ...obj, options };
    }

    public async handleExternal(source: IPCSource, eventType: string, data: any[]): Promise<DataResponse> {
        switch (eventType) {
            case "add-window": {
                const copyParams: MonkeyParams | null = this.normalizeParams({ ...data[0] });
                if (copyParams === null) {
                    return { body: undefined, code: HTTPStatusCodes.BAD_REQUEST }
                }

                const params: MonkeyParams = { ...copyParams, sourceModule: source };
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
                return { body: undefined, code: HTTPStatusCodes.OK };

            }

            case "reattach": {
                this.monkeyMap[source.getIPCSource()]?.reattach();
                return { body: undefined, code: HTTPStatusCodes.OK };
            }

            case "wait-for-window": {
                this.monkeyMap[source.getIPCSource()]?.waitForWindow();
                return { body: undefined, code: HTTPStatusCodes.OK };
            }


            default: {
                return { body: undefined, code: HTTPStatusCodes.NOT_IMPLEMENTED }
            }
        }



    }



}