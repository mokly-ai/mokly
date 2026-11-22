import assert from "node:assert/strict";

import type { UpdateDependencies, Updater } from "../updates.js";

type CheckResult = Awaited<ReturnType<Updater["checkForUpdates"]>>;

/** An electron-updater double that records calls and lets a test fire events. */
export function updateDouble(
  options: {
    response?: number;
    native?: boolean;
    result?: CheckResult;
    failing?: boolean;
    held?: boolean;
  } = {},
) {
  const events = new Map<string, (input: never) => void>();
  const nativeEvents = new Map<string, (error: never) => void>();
  const calls: string[] = [];
  const dialogs: string[] = [];
  let release = () => {};
  const updater: Updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    on: (name: string, handler: (input: never) => void) => {
      events.set(name, handler);
    },
    setFeedURL: (feed) => {
      assert.deepEqual(feed, {
        provider: "github",
        owner: "mokly-ai",
        repo: "mokly-desktop",
      });
      calls.push("feed");
    },
    checkForUpdates: async () => {
      calls.push("check");
      if (options.held)
        await new Promise<void>((done) => {
          release = done;
        });
      if (options.failing) throw new Error("offline");
      return options.result === undefined
        ? { isUpdateAvailable: false, updateInfo: { version: "0.1.0" } }
        : options.result;
    },
    quitAndInstall: () => {
      calls.push("install");
    },
  };
  let tick = () => {};
  const dependencies: UpdateDependencies = {
    updater,
    nativeUpdater: options.native
      ? {
          on: (name: string, handler: (error: never) => void) => {
            nativeEvents.set(name, handler);
          },
        }
      : undefined,
    showDialog: async (dialog) => {
      dialogs.push(String(dialog.message));
      return { response: options.response ?? 1 };
    },
    openExternal: async (url) => {
      calls.push(url);
    },
    every: (callback, milliseconds) => {
      assert.equal(milliseconds, 14_400_000);
      tick = callback;
      return () => {
        calls.push("stop");
      };
    },
    warn: () => {
      calls.push("warn");
    },
  };
  return {
    dependencies,
    updater,
    calls,
    dialogs,
    tick: () => tick(),
    release: () => release(),
    emit: (name: string, version: string) =>
      (events.get(name) as (info: { version: string }) => void)({ version }),
    native: (name: string) => (nativeEvents.get(name) as () => void)(),
  };
}
