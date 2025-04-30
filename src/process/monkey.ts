import { spawn } from "child_process";
import { BaseWindow, WebContentsView, Rectangle } from "electron";
import { Window, windowManager } from "node-window-manager";
import MonkeyCoreProcess from "./main";
import { screen } from "electron"
import { MonkeyParams } from "./monkey-params";

const MINIMIZED_WIDTH: number = 160

const SEC_PER_CHECK: number = 1;
const TOTAL_CHECK_TIME_SEC: number = 10;

export default class Monkey {

    private readonly process: MonkeyCoreProcess;

    private nexusWindowHandle: number;

    public isShown: boolean;
    public appWindow: Window;

    public monkeyParams: MonkeyParams;

    private windowCheckerInterval: NodeJS.Timeout;

    private isAttached: boolean = true;


    public constructor(process: MonkeyCoreProcess, monkeyParams: MonkeyParams) {
        this.monkeyParams = monkeyParams;
        this.process = process;

        windowManager.on('window-activated', this.onWindowChange.bind(this))

        this.nexusWindowHandle = BaseWindow.getAllWindows()[0].getNativeWindowHandle().readInt32LE(0);

        this.waitForWindow()
    }

    public waitForWindow() {
        this.waitForRealWindow().then((appWindow: Window) => {
            this.attachHandlersToWindow(appWindow);
        }).catch(err => {
            console.error(err);
        });
    }



    private onWindowChange(window: Window) {
        if (window.path === this.monkeyParams.exePath) { // activated window, swap modules?
            if (BaseWindow.getAllWindows()[0].isMinimized()) {
                BaseWindow.getAllWindows()[0].restore();
            }
            this.process.requestExternal(this.monkeyParams.sourceModule.getIPCSource(), "request-swap");
        }
    }



    private waitForRealWindow(): Promise<Window> {
        return new Promise((resolve, reject) => {
            const startMS: number = Date.now();
            let checkCount: number = 0;


            const check = () => {
                if (checkCount === 1) { // attempt to spawn the window after 1 try
                    if (this.monkeyParams.exePath.trim() !== "") {
                        console.info(`🐒 ${this.monkeyParams.appName} Monkey: Making a new ${this.monkeyParams.appName} instance.`);
                        spawn(this.monkeyParams.exePath, [], { detached: !this.monkeyParams.closeOnExit, stdio: 'ignore' })
                            .on('error', (err: any) => {
                                if (err.code === "ENOENT") { // file doesn't exist
                                    console.warn(`🐒 ${this.monkeyParams.appName} Monkey: Could not make a new instance from path ${this.monkeyParams.exePath}`);
                                } else {
                                    console.error(err)
                                }
                            });
                    }
                }

                const best: Window | undefined = this.findBestWindow();
                if (best !== undefined) {
                    console.info(`🐒 ${this.monkeyParams.appName} Monkey: Found window in ${checkCount} loops.`);
                    return resolve(best);
                }

                if (Date.now() - startMS >= (TOTAL_CHECK_TIME_SEC * 1000)) {
                    return reject(`🐒 ${this.monkeyParams.appName} Monkey: Could not find the ${this.monkeyParams.appName} window found within timeout.`);
                }

                setTimeout(check, (SEC_PER_CHECK * 1000));
                checkCount++;
            };

            check();
        });
    }



    private attachHandlersToWindow(appWindow: Window, newWindow: boolean = true) {
        if (newWindow) {
            this.monkeyParams.callback("found-window");
        }
        this.isAttached = true;

        this.appWindow = appWindow;
        this.appWindow.restore();

        clearInterval(this.windowCheckerInterval)
        this.windowCheckerInterval = setInterval(() => {
            if (!this.appWindow.isWindow()) { // we've lost the window
                this.onWindowLost()
            }
        }, 1000);

        if (this.isShown) {
            this.show();
        } else {
            this.hide();
        }

        appWindow.setOwner(this.nexusWindowHandle);

        this.resize();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        window.contentView.children[0].on('bounds-changed', this.resizeListener)
        window.on('resize', this.resizeListener)
        window.on('move', this.resizeListener)
    }

    private readonly resizeListener = () => this.resize();

    private onWindowLost() {
        clearInterval(this.windowCheckerInterval);

        console.warn(`🐒 ${this.monkeyParams.appName} Monkey: Lost reference to window.`);
        this.monkeyParams.callback("lost-window");
    }

    public cleanup() {
        clearInterval(this.windowCheckerInterval);

        windowManager.removeAllListeners();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];

        window.contentView.children[0].removeListener('bounds-changed', this.resizeListener);
        window.removeListener('resize', this.resizeListener);
        window.removeListener('move', this.resizeListener);
    }

    public detach() {
        this.isAttached = false;

        console.info(`🐒 ${this.monkeyParams.appName} Monkey: Detaching window.`);
        this.appWindow.setOwner(null);
        this.show()

    }

    public reattach() {
        this.isAttached = true;

        console.info(`🐒 ${this.monkeyParams.appName} Monkey: Reattaching window.`);
        this.appWindow.setOwner(this.nexusWindowHandle);
        this.attachHandlersToWindow(this.appWindow, false);
        this.show()

    }

    public isMinimized(): boolean {
        return this.appWindow?.getBounds().width === MINIMIZED_WIDTH;
    }

    public show() {
        this.isShown = true;
        if (!this.isAttached) {
            return;
        }
        this.monkeyParams.callback("show");

        this.appWindow?.restore();
        this.appWindow?.setOpacity(1);
        this.appWindow?.toggleTransparency(false);
        this.appWindow?.bringToTop();

        this.resize();
    }

    public hide() {
        this.isShown = false;

        if (!this.isAttached) {
            return;
        }
        this.monkeyParams.callback("hide");

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
        if (!this.isAttached) {
            return;
        }

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
            x: (windowContentBounds.x + 70 * windowZoom) / scales.height,
            y: (windowContentBounds.y + 35 * windowZoom + 1) / scales.height,
            width: (windowContentBounds.width - 70 * windowZoom) / scales.width,
            height: (windowContentBounds.height - 35 * windowZoom - 1) / scales.height,
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


