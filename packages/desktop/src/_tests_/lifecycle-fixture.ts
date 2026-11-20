import { EventEmitter } from "node:events";

import type { App, BrowserWindow } from "electron";

import type { DesktopLifecycleDependencies } from "../lifecycle.js";

export function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export class TestWindow extends EventEmitter {
  webContents = new EventEmitter();
  destroyed = false;
  minimized = false;
  restores = 0;
  focuses = 0;
  shows = 0;
  urls: string[] = [];
  loading?: (url: string) => Promise<void>;
  isDestroyed() {
    return this.destroyed;
  }
  isMinimized() {
    return this.minimized;
  }
  restore() {
    this.minimized = false;
    this.restores++;
  }
  focus() {
    this.focuses++;
  }
  show() {
    this.shows++;
  }
  loadURL(url: string) {
    this.urls.push(url);
    return this.loading?.(url) ?? Promise.resolve();
  }
  close() {
    this.destroyed = true;
    this.emit("closed");
  }
}

export function lifecycleFixture(platform = "darwin") {
  const app = new EventEmitter();
  const ready = deferred();
  const windows: TestWindow[] = [];
  const errors: unknown[] = [];
  let quits = 0;
  let prepare = () => {};
  let decorate: (window: TestWindow) => void = () => {};
  const dependencies: DesktopLifecycleDependencies = {
    app: Object.assign(app, {
      requestSingleInstanceLock: () => true,
      quit: () => {
        quits++;
      },
      whenReady: () => ready.promise,
    }) as unknown as DesktopLifecycleDependencies["app"],
    platform,
    arguments: [],
    prepare: () => prepare(),
    createWindow: () => {
      const window = new TestWindow();
      decorate(window);
      windows.push(window);
      return window as unknown as BrowserWindow;
    },
    wireWindow: () => {},
    updates: () => ({ check: () => {}, stop: () => {} }),
    menu: () => {},
    warn: (error) => {
      errors.push(error);
    },
  };
  return {
    app: app as EventEmitter & Pick<App, "quit">,
    ready,
    windows,
    errors,
    dependencies,
    quits: () => quits,
    prepare: (callback: () => void) => {
      prepare = callback;
    },
    decorate: (callback: (window: TestWindow) => void) => {
      decorate = callback;
    },
  };
}

/** Drain promise continuations by event order, without a clock assertion. */
export async function settled(): Promise<void> {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
}
