import assert from "node:assert/strict";
import test from "node:test";

import { startUpdates, updateDialog, updateMode } from "../updates.js";
import type { Updater, UpdateDependencies } from "../updates.js";

function double(response = 1) {
  const events = new Map<string, (info: { version: string }) => void>();
  const calls: string[] = [];
  const updater: Updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    on: (name: string, handler: (info: never) => void) => {
      events.set(name, handler as (info: { version: string }) => void);
    },
    setFeedURL: (options) => {
      assert.deepEqual(options, {
        provider: "github",
        owner: "mokly-ai",
        repo: "mokly-desktop",
      });
      calls.push("feed");
    },
    checkForUpdates: async () => {
      calls.push("check");
    },
    quitAndInstall: () => {
      calls.push("install");
    },
  };
  let tick = () => {};
  const dependencies: UpdateDependencies = {
    updater,
    showDialog: async (options) => {
      calls.push(String(options.message));
      return { response };
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
    warn: assert.fail,
  };
  return { dependencies, calls, events, tick: () => tick() };
}

test("only packaged macOS and AppImages install; deb offers a release page", () => {
  assert.equal(updateMode(false, "darwin", undefined), "off");
  assert.equal(updateMode(false, "linux", "/app.AppImage"), "off");
  assert.equal(updateMode(true, "darwin", undefined), "install");
  assert.equal(updateMode(true, "linux", "/app.AppImage"), "install");
  assert.equal(updateMode(true, "linux", undefined), "release");
  assert.deepEqual(updateDialog("0.1.0-alpha.2", false).buttons, [
    "Restart now",
    "Later",
  ]);
  assert.deepEqual(updateDialog("0.1.0-alpha.2", true).buttons, [
    "Open release page",
    "Later",
  ]);
});

test("development never touches the feed or schedules a check", () => {
  const fixture = double();
  const updates = startUpdates(fixture.dependencies, "off");
  updates.check();
  updates.stop();
  fixture.tick();
  assert.deepEqual(fixture.calls, []);
});

test("the updater checks at launch and every four hours; Later installs on quit", async () => {
  const fixture = double();
  const updates = startUpdates(fixture.dependencies, "install");
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(fixture.dependencies.updater.allowPrerelease, true);
  assert.equal(fixture.dependencies.updater.autoDownload, true);
  assert.equal(fixture.dependencies.updater.autoInstallOnAppQuit, true);
  fixture.tick();
  fixture.events.get("update-downloaded")!({ version: "0.1.0-alpha.2" });
  await Promise.resolve();
  fixture.events.get("update-downloaded")!({ version: "0.1.0-alpha.2" });
  updates.stop();
  assert.deepEqual(fixture.calls, [
    "feed",
    "check",
    "check",
    "Mokly 0.1.0-alpha.2 is ready",
    "stop",
  ]);
});

test("Restart now installs the downloaded version; deb never downloads or installs", async () => {
  const install = double(0);
  startUpdates(install.dependencies, "install");
  install.events.get("update-downloaded")!({ version: "0.1.0-alpha.2" });
  await Promise.resolve();
  assert.ok(install.calls.includes("install"));
  const release = double(0);
  startUpdates(release.dependencies, "release");
  assert.equal(release.dependencies.updater.autoDownload, false);
  assert.equal(release.dependencies.updater.autoInstallOnAppQuit, false);
  assert.equal(release.events.has("update-downloaded"), false);
  release.events.get("update-available")!({ version: "0.1.0-alpha.3" });
  await Promise.resolve();
  assert.ok(
    release.calls.includes(
      "https://github.com/mokly-ai/mokly-desktop/releases/tag/v0.1.0-alpha.3",
    ),
  );
  assert.equal(release.calls.includes("install"), false);
});
