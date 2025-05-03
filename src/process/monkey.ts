import { spawn } from "child_process";
import { BaseWindow, WebContentsView, Rectangle, app } from "electron";
import { Window, windowManager } from "node-window-manager";
import MonkeyCoreProcess from "./main";
import { screen } from "electron"
import { MonkeyParams } from "./monkey-params";

const MINIMIZED_WIDTH: number = 160;
const SEC_PER_CHECK: number = 1;
const TOTAL_CHECK_TIME_SEC: number = 10;

export default class Monkey {

    private readonly process: MonkeyCoreProcess;
    private readonly nexusWindow: BaseWindow;
    private readonly nexusWindowHandle: number;
    private readonly monkeyParams: MonkeyParams;


    public appWindow: Window;
    private windowCheckerInterval: NodeJS.Timeout;
    private isAttached: boolean = true;

    public constructor(process: MonkeyCoreProcess, monkeyParams: MonkeyParams) {
        this.process = process;
        this.nexusWindow = BaseWindow.getAllWindows()[0];
        this.monkeyParams = monkeyParams;

        windowManager.on('window-activated', this.onWindowChange.bind(this));

        this.nexusWindowHandle = this.nexusWindow.getNativeWindowHandle().readInt32LE(0);


        if (monkeyParams.options.locateOnStartup) {
            this.waitForWindow(true);
        } else if (monkeyParams.options.openOnStartup) {
            this.spawnApp();

        }

    }

    public waitForWindow(startup: boolean = false) {
        this.waitForRealWindow(startup).then((appWindow: Window) => {
            this.attachHandlersToWindow(appWindow);
        }).catch(err => {
            console.error(err);
        });
    }

    private spawnApp() {
        if (this.monkeyParams.exePath.trim() !== "") {
            console.info(`🐒 ${this.monkeyParams.appName} Monkey: Making a new ${this.monkeyParams.appName} instance.`);
            spawn(this.monkeyParams.exePath, [], { detached: !this.monkeyParams.options.closeOnExit, stdio: 'ignore' })
                .on('error', (err: any) => {
                    if (err.code === "ENOENT") { // file doesn't exist
                        console.warn(`🐒 ${this.monkeyParams.appName} Monkey: Could not make a new instance from path ${this.monkeyParams.exePath}`);
                    } else {
                        console.error(err)
                    }
                });
        }
    }



    private onWindowChange(window: Window) {
        if (window.path === (this.monkeyParams.windowPath ?? this.monkeyParams.exePath)) { // activated window, swap modules?
            if (this.nexusWindow.isMinimized()) {
                this.nexusWindow.restore();
            }
            this.process.requestExternal(this.monkeyParams.sourceModule.getIPCSource(), "request-swap");
        }
    }



    private waitForRealWindow(firstLaunch: boolean = false): Promise<Window> {
        return new Promise((resolve, reject) => {
            const startMS: number = Date.now();
            let checkCount: number = 0;


            const check = () => {
                if (firstLaunch && this.monkeyParams.options.openOnStartup && checkCount === 1) {
                    this.spawnApp();
                }

                const best: Window | undefined = this.findBestWindow();
                if (best !== undefined) {
                    console.info(`🐒 ${this.monkeyParams.appName} Monkey: Located window in ${checkCount + 1} attempts.`);
                    return resolve(best);
                }

                if (Date.now() - startMS >= (TOTAL_CHECK_TIME_SEC * 1000)) {
                    return reject(`🐒 ${this.monkeyParams.appName} Monkey: Could not locate ${this.monkeyParams.appName} within timeout.`);
                }

                setTimeout(check, (SEC_PER_CHECK * 1000));
                checkCount++;
            };

            check();
        });
    }



    private attachHandlersToWindow(appWindow: Window, newWindow: boolean = true) {
        if (newWindow) {
            this.monkeyParams.onEvent("found-window");
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

        if (this.monkeyParams.options.isCurrentlyShown) {
            this.show();
        } else {
            this.hide();
        }

        appWindow.setOwner(this.nexusWindowHandle);

        this.resize();
        this.nexusWindow.contentView.children[0].on('bounds-changed', this.resizeListener)
        this.nexusWindow.on('resize', this.resizeListener)
        this.nexusWindow.on('move', this.resizeListener)
    }

    private readonly resizeListener = () => this.resize();

    private onWindowLost() {
        clearInterval(this.windowCheckerInterval);

        console.warn(`🐒 ${this.monkeyParams.appName} Monkey: Lost reference to window.`);
        this.monkeyParams.onEvent("lost-window");
    }

    public cleanup() {
        clearInterval(this.windowCheckerInterval);

        windowManager.removeAllListeners();

        this.nexusWindow.contentView.children[0].removeListener('bounds-changed', this.resizeListener);
        this.nexusWindow.removeListener('resize', this.resizeListener);
        this.nexusWindow.removeListener('move', this.resizeListener);
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
        this.monkeyParams.options.isCurrentlyShown = true;
        if (!this.isAttached) {
            return;
        }
        this.monkeyParams.onEvent("show");

        this.appWindow?.restore();
        this.appWindow?.setOpacity(1);
        this.appWindow?.toggleTransparency(false);
        this.appWindow?.bringToTop();

        this.resize();
    }

    public hide() {
        this.monkeyParams.options.isCurrentlyShown = false;

        if (!this.isAttached) {
            return;
        }
        this.monkeyParams.onEvent("hide");

        this.appWindow?.toggleTransparency(true);
        this.appWindow?.setOpacity(0);
    }

    private getMonitorSize(): Rectangle {
        const appScale: number | undefined = this.appWindow?.getMonitor().getScaleFactor();
        const scale = screen.getDisplayMatching(this.nexusWindow.getBounds()).scaleFactor;
        const display = screen.getDisplayMatching(this.nexusWindow.getBounds()).bounds;
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
            if (this.monkeyParams.options.isCurrentlyShown) {
                this.appWindow.restore()
            } else {
                return;
            }
        }

        const windowZoom: number = (this.nexusWindow.contentView.children[0] as WebContentsView).webContents.zoomFactor

        const appMonitorSize: Rectangle = this.getMonitorSize();
        const windowContentBounds: Rectangle = this.nexusWindow.getContentBounds();

        const screenBounds: Rectangle = screen.getDisplayMatching(this.nexusWindow.getBounds()).bounds
        let scales = {
            width: screenBounds.width / appMonitorSize.width,
            height: screenBounds.height / appMonitorSize.height
        }

        this.appWindow?.setBounds({
            x: (windowContentBounds.x + (70 + (this.monkeyParams.options.offset.x ?? 0)) * windowZoom) / scales.height,
            y: (windowContentBounds.y + (this.monkeyParams.options.offset.y ?? 0) * windowZoom + 1) / scales.height,
            width: (windowContentBounds.width - (70 + (this.monkeyParams.options.offset.width ?? 0)) * windowZoom) / scales.width,
            height: (windowContentBounds.height + (this.monkeyParams.options.offset.height ?? 0) * windowZoom - 1) / scales.height,
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


