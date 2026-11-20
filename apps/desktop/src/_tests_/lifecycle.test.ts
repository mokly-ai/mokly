import assert from "node:assert/strict";
import test from "node:test";

import { startDesktop } from "../lifecycle.js";
import { DESKTOP_ORIGIN } from "../origin.js";

import { deferred, lifecycleFixture, settled } from "./lifecycle-fixture.js";

const dashboard = DESKTOP_ORIGIN + "/dashboard";

const address = `mokly://auth/desktop/callback#grant=${"a".repeat(64)}`;
const callback = `${DESKTOP_ORIGIN}/auth/desktop/callback#grant=${"a".repeat(64)}`;

test(`desktop: a handoff can replace the initial dashboard without quitting the app`, async () => {
  const fixture = lifecycleFixture();
  const initial = deferred();
  fixture.decorate((window) => {
    window.loading = (url) =>
      url === dashboard ? initial.promise : Promise.resolve();
  });
  startDesktop(fixture.dependencies);
  fixture.ready.resolve();
  await settled();
  fixture.app.emit("open-url", { preventDefault: () => {} }, address);
  initial.reject(
    Object.assign(new Error("superseded"), { code: "ERR_ABORTED" }),
  );
  await settled();
  assert.deepEqual(fixture.windows[0].urls, [
    dashboard,
    "about:blank",
    callback,
  ]);
  assert.equal(fixture.quits(), 0);
});

test(`desktop: startup and second-instance handoffs load only their callback`, async () => {
  const fixture = lifecycleFixture();
  startDesktop(fixture.dependencies);
  fixture.app.emit("open-url", { preventDefault: () => {} }, address);
  fixture.ready.resolve();
  await settled();
  assert.deepEqual(fixture.windows[0].urls, ["about:blank", callback]);
  fixture.windows[0].webContents.emit("did-navigate", {}, callback);
  fixture.windows[0].webContents.emit("did-navigate", {}, dashboard);
  fixture.windows[0].close();
  const next = address.replace(/a{64}/, "b".repeat(64));
  fixture.app.emit("second-instance", {}, ["binary", next]);
  await settled();
  assert.deepEqual(fixture.windows[1].urls, [
    "about:blank",
    callback.replace(/a{64}/, "b".repeat(64)),
  ]);
});

test(`desktop: OS reopen and child-frame events cannot interrupt an active handoff`, async () => {
  const fixture = lifecycleFixture();
  startDesktop(fixture.dependencies);
  fixture.ready.resolve();
  await settled();
  fixture.app.emit("open-url", { preventDefault: () => {} }, address);
  fixture.app.emit("activate");
  fixture.app.emit("second-instance", {}, [address]);
  const next = address.replace(/a{64}/, "c".repeat(64));
  fixture.windows[0].webContents.emit(
    "did-navigate-in-page",
    {},
    "https://catalogue.example/other",
    false,
  );
  fixture.app.emit("second-instance", {}, [next]);
  await settled();
  assert.deepEqual(fixture.windows[0].urls, [
    dashboard,
    "about:blank",
    callback,
  ]);
  assert.equal(fixture.quits(), 0);
});

test(`desktop: one pending handoff blocks another grant until navigation leaves its landing`, async () => {
  const fixture = lifecycleFixture();
  fixture.dependencies.arguments = [address];
  startDesktop(fixture.dependencies);
  fixture.ready.resolve();
  await settled();
  const window = fixture.windows[0];
  const next = address.replace(/a{64}/, "b".repeat(64));
  fixture.app.emit("second-instance", {}, [next]);
  assert.deepEqual(window.urls, ["about:blank", callback]);
  window.webContents.emit("did-navigate", {}, callback);
  window.webContents.emit(
    "did-navigate-in-page",
    {},
    callback.split("#")[0],
    true,
  );
  fixture.app.emit("second-instance", {}, [next]);
  assert.deepEqual(window.urls, ["about:blank", callback]);
  window.webContents.emit("did-navigate-in-page", {}, dashboard, true);
  fixture.app.emit("second-instance", {}, [next]);
  await settled();
  assert.deepEqual(window.urls, [
    "about:blank",
    callback,
    "about:blank",
    callback.replace(/a{64}/, "b".repeat(64)),
  ]);
});

for (const event of ["activate", "second-instance"]) {
  test(`macOS ${event} loads a closed window and preserves an existing page`, async () => {
    const fixture = lifecycleFixture();
    startDesktop(fixture.dependencies);
    fixture.ready.resolve();
    await settled();
    fixture.windows[0].close();
    fixture.app.emit("window-all-closed");
    assert.equal(fixture.quits(), 0);
    if (event === "activate") fixture.app.emit(event);
    else fixture.app.emit(event, {}, ["binary"]);
    await settled();
    assert.equal(fixture.windows.length, 2);
    const reopened = fixture.windows[1];
    assert.deepEqual(reopened.urls, [dashboard]);
    reopened.minimized = true;
    if (event === "activate") fixture.app.emit(event);
    else fixture.app.emit(event, {}, ["binary"]);
    assert.equal(reopened.restores, 1);
    assert.deepEqual(reopened.urls, [dashboard]);
  });
}

test("initialization failures stay fatal and stop before creating a window", async () => {
  const fixture = lifecycleFixture();
  fixture.prepare(() => {
    throw new Error("configuration failed");
  });
  startDesktop(fixture.dependencies);
  fixture.ready.resolve();
  await settled();
  assert.equal(fixture.quits(), 1);
  assert.equal(fixture.windows.length, 0);
  assert.equal(fixture.errors.length, 1);
});
