import assert from "node:assert/strict";
import test from "node:test";

import {
  manualAnswers,
  startUpdates,
  updateDialog,
  updateMode,
} from "../updates.js";
import type { UpdateDependencies } from "../updates.js";

import { updateDouble } from "./update-double.js";

const settle = () => new Promise<void>((done) => setImmediate(done));

test("only packaged release builds update; deb offers a release page", () => {
  assert.equal(updateMode(false, true, "darwin", undefined), "off");
  assert.equal(updateMode(true, false, "darwin", undefined), "off");
  assert.equal(updateMode(true, false, "linux", "/app.AppImage"), "off");
  assert.equal(updateMode(false, true, "linux", "/app.AppImage"), "off");
  assert.equal(updateMode(true, true, "darwin", undefined), "install");
  assert.equal(updateMode(true, true, "linux", "/app.AppImage"), "install");
  assert.equal(updateMode(true, true, "linux", undefined), "release");
  assert.deepEqual(updateDialog("0.1.0", false).buttons, [
    "Restart now",
    "Later",
  ]);
  assert.deepEqual(updateDialog("0.1.0", true).buttons, [
    "Open release page",
    "Later",
  ]);
});

test("a build with the updater off never touches the feed", async () => {
  const fixture = updateDouble();
  const updates = startUpdates(fixture.dependencies, "off");
  assert.equal(updates.available, false);
  await updates.check();
  updates.stop();
  fixture.tick();
  assert.deepEqual(fixture.calls, []);
});

test("the updater checks at launch and every four hours", async () => {
  const fixture = updateDouble();
  const updates = startUpdates(fixture.dependencies, "install");
  await settle();
  assert.equal(updates.available, true);
  assert.equal(fixture.updater.allowPrerelease, false);
  assert.equal(fixture.updater.autoDownload, true);
  assert.equal(fixture.updater.autoInstallOnAppQuit, true);
  fixture.tick();
  await settle();
  updates.stop();
  assert.deepEqual(fixture.calls, ["feed", "check", "check", "stop"]);
});

test("macOS offers a version once, and only after the native updater accepts it", async () => {
  const fixture = updateDouble({ native: true });
  startUpdates(fixture.dependencies, "install");
  await settle();
  fixture.emit("update-downloaded", "0.2.0");
  await settle();
  assert.equal(fixture.dialogs.length, 0);
  fixture.native("update-downloaded");
  fixture.native("update-downloaded");
  await settle();
  assert.deepEqual(fixture.dialogs, ["Mokly 0.2.0 is ready"]);
  assert.equal(fixture.calls.includes("install"), false);
});

test("Restart now installs; without a native updater the download is ready", async () => {
  const fixture = updateDouble({ response: 0 });
  startUpdates(fixture.dependencies, "install");
  fixture.emit("update-downloaded", "0.2.0");
  await settle();
  assert.deepEqual(fixture.dialogs, ["Mokly 0.2.0 is ready"]);
  assert.ok(fixture.calls.includes("install"));
});

test("a manual check answers each outcome", async () => {
  const answer = async (
    result: Awaited<
      ReturnType<UpdateDependencies["updater"]["checkForUpdates"]>
    > | null,
    failing = false,
  ) => {
    const fixture = updateDouble({ result, failing });
    const updates = startUpdates(fixture.dependencies, "install");
    await settle();
    fixture.dialogs.length = 0;
    await updates.check();
    return fixture.dialogs;
  };
  const found = { isUpdateAvailable: true, updateInfo: { version: "0.2.0" } };
  const none = { isUpdateAvailable: false, updateInfo: { version: "0.1.0" } };
  assert.deepEqual(await answer(none), [manualAnswers.current]);
  assert.deepEqual(await answer(found), [manualAnswers.downloading]);
  assert.deepEqual(await answer(null), [manualAnswers.failed]);
  assert.deepEqual(await answer(none, true), [manualAnswers.failed]);
});

test("a manual check repeats the ready dialog for a version that waits", async () => {
  const fixture = updateDouble();
  const updates = startUpdates(fixture.dependencies, "install");
  fixture.emit("update-downloaded", "0.2.0");
  await settle();
  await updates.check();
  assert.deepEqual(fixture.dialogs, [
    "Mokly 0.2.0 is ready",
    "Mokly 0.2.0 is ready",
  ]);
});

test("a version that becomes ready during a manual check gets one dialog", async () => {
  const fixture = updateDouble({ held: true });
  const updates = startUpdates(fixture.dependencies, "install");
  const manual = updates.check();
  fixture.emit("update-downloaded", "0.2.0");
  fixture.release();
  await manual;
  assert.deepEqual(fixture.dialogs, ["Mokly 0.2.0 is ready"]);
});

test("deb never downloads or installs, and offers the release page", async () => {
  const found = { isUpdateAvailable: true, updateInfo: { version: "0.2.0" } };
  const fixture = updateDouble({ response: 0, result: found });
  const updates = startUpdates(fixture.dependencies, "release");
  assert.equal(fixture.updater.autoDownload, false);
  assert.equal(fixture.updater.autoInstallOnAppQuit, false);
  fixture.emit("update-available", "0.2.0");
  await settle();
  await updates.check();
  const page = "https://github.com/mokly-ai/mokly-desktop/releases/tag/v0.2.0";
  assert.deepEqual(
    fixture.calls.filter((call) => call === page),
    [page, page],
  );
  assert.equal(fixture.calls.includes("install"), false);
});
