import { DataResponse, HTTPStatusCodes, IPCSource, Process, Setting } from "@nexus/nexus-module-builder"
import Monkey from "./monkey";
import { MonkeyParams } from "./monkey-params";


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
    }

    public async onExit(): Promise<void> {
        for (const monkey of Object.values(this.monkeyMap)) {
            monkey.appWindow?.setOwner(null);
            monkey.show();
        }
    }

    public async handleExternal(source: IPCSource, eventType: string, data: any[]): Promise<DataResponse> {
        switch (eventType) {
            case "add-window": {
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