import { spawn } from "child_process";
import { BaseWindow, WebContentsView, Rectangle } from "electron";
import { Window, windowManager } from "node-window-manager";
import MonkeyCoreProcess from "./main";
import { screen } from "electron"
import { Filter, MonkeyParams } from "./monkey-params";

const MINIMIZED_WIDTH: number = 160

export default class Monkey {

    private readonly process: MonkeyCoreProcess;

    private nexusWindowHandle: number;
    public originalWindowID: number;
    private exePath: string;

    public isShown: boolean;
    public appWindow: Window;

    public monkeyParams: MonkeyParams;


    public constructor(process: MonkeyCoreProcess, monkeyParams: MonkeyParams) {
        this.monkeyParams = monkeyParams;
        this.process = process;

        windowManager.on('window-activated', this.onWindowChange.bind(this))

        this.nexusWindowHandle = BaseWindow.getAllWindows()[0].getNativeWindowHandle().readInt32LE(0);

        const existingAppWindow: Window = this.findBestWindow();
        if (existingAppWindow === undefined) {
            if (monkeyParams.exePath.trim() !== "") {
                console.info(`🐒 ${monkeyParams.appName} Monkey: Making a new ${monkeyParams.appName} instance.`);
                spawn(monkeyParams.exePath, [], { detached: !monkeyParams.closeOnExit, stdio: 'ignore' })
                    .on('error', (err) => {
                        console.error(err)
                    });
            }


            this.waitForRealWindow().then((appWindow: Window) => {
                this.attachHandlersToWindow(appWindow);
            }).catch(err => {
                console.error(err);
            });

        } else {
            this.attachHandlersToWindow(existingAppWindow);
        }
    }



    private onWindowChange(window: Window) {
        if (window.path === this.monkeyParams.exePath) { // activated window, swap modules?
            if (BaseWindow.getAllWindows()[0].isMinimized()) {
                BaseWindow.getAllWindows()[0].restore();
            }

            this.process.requestExternal(this.monkeyParams.sourceModule.getIPCSource(), "request-swap");
        }
    }



    private waitForRealWindow(timeout: number = 100000, interval: number = 200): Promise<Window> {
        return new Promise((resolve, reject) => {
            const startMS: number = Date.now();

            const check = () => {
                const best: Window | undefined = this.findBestWindow();
                if (best !== undefined) {
                    return resolve(best);
                }

                if (Date.now() - startMS >= timeout) {
                    return reject(`🐒 ${this.monkeyParams.appName} Monkey: Could not find the ${this.monkeyParams.appName} window found within timeout.`);
                }

                setTimeout(check, interval);
            };

            check();
        });
    }



    private attachHandlersToWindow(appWindow: Window) {
        this.originalWindowID = appWindow.id;

        console.info(`🐒 ${this.monkeyParams.appName} Monkey: ${this.monkeyParams.appName} instance found.`);

        this.appWindow = appWindow;

        if (!this.isShown) {
            this.hide();
        } else {
            this.show();
        }

        appWindow.setOwner(this.nexusWindowHandle);

        this.resize();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        window.contentView.children[0].on('bounds-changed', this.resizeListener)
        window.on('resize', this.resizeListener)
        window.on('move', this.resizeListener)
    }

    private readonly resizeListener = () => this.resize();
    public cleanup() {
        windowManager.removeAllListeners();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        window.removeListener('resize', this.resizeListener);
        window.removeListener('move', this.resizeListener);
        window.contentView.children[0].removeListener('bounds-changed', this.resizeListener);
    }


    public isMinimized(): boolean {
        return this.appWindow?.getBounds().width === MINIMIZED_WIDTH;
    }

    public show() {
        this.appWindow?.setOpacity(1);
        this.appWindow?.toggleTransparency(false);
        this.appWindow?.bringToTop();
        this.resize()
    }

    public hide() {
        this.appWindow?.toggleTransparency(true);
        this.appWindow?.setOpacity(0);
    }

    private getMonitorSize(): Rectangle {
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        const appScale: number | undefined = this.appWindow?.getMonitor().getScaleFactor();
        const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
        const display = screen.getDisplayMatching(window.getBounds()).bounds;
        return {
            x: Math.floor(display.x * scale / appScale),
            y: Math.floor(display.y * scale / appScale),
            width: Math.floor(display.width * scale / appScale),
            height: Math.floor(display.height * scale / appScale)
        }
    }


    public resize() {
        if (this.isMinimized()) {
            if (this.isShown) {
                this.appWindow.restore()
            } else {
                return;
            }
        }

        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        const windowZoom = (window.contentView.children[0] as WebContentsView).webContents.zoomFactor

        const appMonitorSize: Rectangle = this.getMonitorSize();
        const windowContentBounds = window.getContentBounds();

        const screenBounds = screen.getDisplayMatching(window.getBounds()).bounds
        let scales = {
            width: screenBounds.width / appMonitorSize.width,
            height: screenBounds.height / appMonitorSize.height
        }

        this.appWindow?.setBounds({
            x: ((windowContentBounds.x + 70 * windowZoom) / scales.height),
            y: windowContentBounds.y / scales.height,
            width: ((windowContentBounds.width - 70 * windowZoom) / scales.width),
            height: (windowContentBounds.height / scales.height),
        });

    }

    private findBestWindow(): Window | undefined {
        const candidates: Window[] = windowManager.getWindows().filter(this.monkeyParams.filter);

        if (candidates.length > 0) {
            const best: Window = candidates.sort((a, b) => {
                const aArea: number = a.getBounds().width * a.getBounds().height;
                const bArea: number = b.getBounds().width * b.getBounds().height;
                return bArea - aArea;
            })[0];

            return best;
        }
        return undefined;
    }
}


