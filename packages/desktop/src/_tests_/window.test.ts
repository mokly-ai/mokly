import assert from "node:assert/strict";
import test from "node:test";

import type {
  App,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
} from "electron";

import { installLifecycle, singleInstance } from "../lifecycle.js";
import { installMenu } from "../menu.js";
import { createWindow, windowBounds } from "../window.js";

const bounds = { x: 50, y: 60, width: 1000, height: 700 };
test("the window restores valid visible bounds and recovers from missing or off-screen state", () => {
  assert.deepEqual(
    windowBounds({
      readState: () => JSON.stringify(bounds),
      visible: () => true,
    }),
    bounds,
  );
  for (const readState of [
    () => "invalid",
    () => "{}",
    () => JSON.stringify({ ...bounds, width: -1 }),
    () => {
      throw new Error("missing");
    },
  ]) {
    assert.deepEqual(windowBounds({ readState, visible: () => true }), {
      width: 1280,
      height: 840,
    });
  }
  assert.deepEqual(
    windowBounds({
      readState: () => JSON.stringify(bounds),
      visible: () => false,
    }),
    { width: 1280, height: 840 },
  );
});

test("the renderer has all fixed protections and saves normal bounds", () => {
  let options: BrowserWindowConstructorOptions | undefined;
  let close = () => {};
  let saved = "";
  const window = {
    on: (_event: string, callback: () => void) => {
      close = callback;
    },
    getNormalBounds: () => bounds,
  } as unknown as BrowserWindow;
  createWindow({
    create: (input) => {
      options = input;
      return window;
    },
    readState: () => "{}",
    visible: () => true,
    saveState: (value) => {
      saved = value;
    },
    warn: assert.fail,
  });
  assert.deepEqual(options?.webPreferences, {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    webviewTag: false,
    allowRunningInsecureContent: false,
  });
  close();
  assert.deepEqual(JSON.parse(saved), bounds);
});

test("single instance rejects a second process and delivers OS events to the running app", () => {
  let quits = 0;
  const events = new Map<string, (...args: unknown[]) => void>();
  const application = {
    requestSingleInstanceLock: () => false,
    quit: () => {
      quits++;
    },
    on: (name: string, handler: (...args: unknown[]) => void) => {
      events.set(name, handler);
    },
  } as unknown as Pick<App, "requestSingleInstanceLock" | "quit" | "on">;
  assert.equal(
    singleInstance(application, () => false, assert.fail),
    false,
  );
  assert.equal(quits, 1);
  application.requestSingleInstanceLock = () => true;
  const received: string[] = [];
  let focuses = 0;
  let prevented = 0;
  assert.equal(
    singleInstance(
      application,
      (url) => {
        received.push(url);
        return true;
      },
      () => {
        focuses++;
      },
    ),
    true,
  );
  events.get("open-url")!(
    {
      preventDefault: () => {
        prevented++;
      },
    },
    "mokly://address",
  );
  events.get("second-instance")!({}, ["binary", "mokly://second"]);
  assert.equal(prevented, 1);
  assert.equal(focuses, 1);
  assert.deepEqual(received, ["mokly://address", "binary", "mokly://second"]);
  let opens = 0;
  installLifecycle(application, "darwin", () => {
    opens++;
  });
  events.get("window-all-closed")!();
  assert.equal(quits, 1);
  events.get("activate")!();
  assert.equal(opens, 1);
  installLifecycle(application, "linux", () => {});
  events.get("window-all-closed")!();
  assert.equal(quits, 2);
});

test("the default menu gains Check for updates in Help", () => {
  const install = (available: boolean) => {
    let options: MenuItemConstructorOptions | undefined;
    let checks = 0;
    const item = {} as MenuItem;
    const submenu = {
      append: (input: MenuItem) => {
        assert.equal(input, item);
      },
    };
    const menu = { items: [{ role: "help", submenu }] } as unknown as Menu;
    installMenu(
      {
        current: () => menu,
        item: (input) => {
          options = input;
          return item;
        },
      },
      {
        available,
        check: () => {
          checks++;
        },
      },
    );
    (options!.click as () => void)();
    return { options: options!, checks };
  };
  const on = install(true);
  assert.equal(on.options.label, "Check for updates");
  assert.equal(on.options.enabled, true);
  assert.equal(on.checks, 1);
  assert.equal(install(false).options.enabled, false);
});
