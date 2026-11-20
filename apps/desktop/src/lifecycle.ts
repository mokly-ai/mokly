import type { App, BrowserWindow } from "electron";

import { createHandoff } from "./handoff.js";
import type { HandoffExchange } from "./handoff.js";
import { DESKTOP_ORIGIN } from "./origin.js";

/** Register delivery before readiness; the OS may send the handoff during startup. */
export function singleInstance(
  app: Pick<App, "requestSingleInstanceLock" | "quit" | "on">,
  receive: (address: string) => boolean,
  focus: () => void,
): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("open-url", (event, address) => {
    event.preventDefault();
    receive(address);
  });
  app.on("second-instance", (_event, arguments_) => {
    for (const address of arguments_) receive(address);
    focus();
  });
  return true;
}

/** macOS retains the app in the Dock; Linux quits after its last window closes. */
export function installLifecycle(
  app: Pick<App, "on" | "quit">,
  platform: string,
  open: () => void,
): void {
  app.on("activate", open);
  app.on("window-all-closed", () => {
    if (platform !== "darwin") app.quit();
  });
}

export interface DesktopLifecycleDependencies {
  app: Pick<App, "requestSingleInstanceLock" | "quit" | "on" | "whenReady">;
  platform: string;
  arguments: readonly string[];
  prepare(exchange: HandoffExchange): void;
  createWindow(): BrowserWindow;
  wireWindow(window: BrowserWindow): void;
  updates(): { check(): void; stop(): void };
  menu(check: () => void): void;
  warn(error: unknown): void;
}

/** Own one window and all OS entry paths without exposing a renderer bridge. */
export function startDesktop(dependencies: DesktopLifecycleDependencies): void {
  const { app, warn } = dependencies;
  let ready = false;
  let window: BrowserWindow | undefined;
  const queued: string[] = [];
  const focus = (active: BrowserWindow) => {
    if (active.isMinimized()) active.restore();
    active.show();
    active.focus();
  };
  const ensureWindow = (): BrowserWindow => {
    if (window && !window.isDestroyed()) return window;
    const active = dependencies.createWindow();
    window = active;
    dependencies.wireWindow(active);
    active.webContents.on("did-navigate", (_event, url) =>
      handoff.navigated(url),
    );
    active.webContents.on("did-navigate-in-page", (_event, url, main) => {
      if (main) handoff.navigated(url);
    });
    active.on("closed", () => {
      if (window === active) window = undefined;
    });
    return active;
  };
  const reopen = () => {
    if (!ready) return;
    const missing = !window || window.isDestroyed();
    const active = ensureWindow();
    focus(active);
    if (missing) void active.loadURL(`${DESKTOP_ORIGIN}/dashboard`).catch(warn);
  };
  const handoff = createHandoff({
    window: () => {
      const active = ensureWindow();
      return { load: (url) => active.loadURL(url), focus: () => focus(active) };
    },
    warn,
  });
  const receive = (address: string) => {
    if (!ready) {
      queued.push(address);
      return false;
    }
    return handoff.receive(address);
  };
  if (!singleInstance(app, receive, reopen)) return;
  app
    .whenReady()
    .then(() => {
      dependencies.prepare(handoff);
      ready = true;
      const active = ensureWindow();
      installLifecycle(app, dependencies.platform, reopen);
      const updates = dependencies.updates();
      dependencies.menu(updates.check);
      app.on("before-quit", updates.stop);
      const handled = [...queued.splice(0), ...dependencies.arguments].some(
        receive,
      );
      if (!handled)
        void active.loadURL(`${DESKTOP_ORIGIN}/dashboard`).catch(warn);
    })
    .catch((error) => {
      warn(error);
      app.quit();
    });
}
