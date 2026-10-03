import assert from "node:assert/strict";
import { test } from "node:test";

import { APPEARANCE_STORAGE_KEY } from "../src/standalone/preference.js";
import { installAppearance } from "../src/standalone/startup.js";

import { environment, frame } from "./appearance_fixture.js";

test("startup assigns each preview's browser context before changing its source", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const lightOnly = frame("details.html");
  const world = environment({
    search: "?scheme=dark",
    frames: [dual, lightOnly],
  });
  const handle = installAppearance(world.document, world.window);
  assert.deepEqual(dual.schemesAtLoad, ["dark"]);
  assert.equal(lightOnly.scheme, "light");
  handle.choose("light");
  assert.deepEqual(dual.schemesAtLoad, ["dark", "light"]);
});

test("the effective appearance is applied to the document root", () => {
  for (const [options, expected] of [
    [{ search: "?scheme=dark" }, "dark"],
    [{ stored: "light", systemDark: true }, "light"],
    [{ initial: "dark" }, "dark"],
    [{}, "auto"],
  ] as const) {
    const world = environment(options);
    installAppearance(world.document, world.window);
    assert.equal(
      world.root.attributes["data-mokly-theme"],
      expected,
      JSON.stringify(options),
    );
  }
});

test("a pin outranks storage and is never saved", () => {
  const world = environment({ search: "?scheme=light", stored: "dark" });
  installAppearance(world.document, world.window);
  assert.equal(world.root.attributes["data-mokly-theme"], "light");
  assert.equal(world.stored(), "dark", "the pin did not overwrite the choice");
});

test("a dark start swaps each frame's source once, before its first load", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const lightOnly = frame("details.html");
  const world = environment({
    search: "?scheme=dark",
    frames: [dual, lightOnly],
  });
  const handle = installAppearance(world.document, world.window);
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  assert.deepEqual(lightOnly.loads, [], "a light-only frame keeps its source");
  // Installing again must not reload a frame that is already correct.
  installAppearance(world.document, world.window);
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  handle.dispose();
});

test("a refresh compares the authored source instead of its resolved URL", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ search: "?scheme=dark", frames: [dual] });
  const handle = installAppearance(world.document, world.window);
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  dual.loads.length = 0;

  handle.refresh();

  assert.deepEqual(dual.loads, []);
});

test("a light start leaves every server-rendered source alone", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ search: "?scheme=light", frames: [dual] });
  installAppearance(world.document, world.window);
  assert.deepEqual(dual.loads, []);
});

test("Auto follows a system change while the document is open", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ frames: [dual] });
  const handle = installAppearance(world.document, world.window);
  assert.equal(world.root.attributes["data-mokly-theme"], "auto");
  world.media.matches = true;
  for (const listener of world.listeners) listener.handler();
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  handle.dispose();
  assert.equal(world.listeners.length, 0, "cleanup removed every listener");
});

test("an explicit choice ignores a system change", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ stored: "light", frames: [dual] });
  installAppearance(world.document, world.window);
  world.media.matches = true;
  for (const listener of world.listeners) listener.handler();
  assert.deepEqual(dual.loads, []);
});

test("choosing an appearance applies and stores it, and Auto clears it", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ frames: [dual] });
  const handle = installAppearance(world.document, world.window);
  handle.choose("dark");
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  assert.equal(world.stored(), "dark");
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  handle.choose("auto");
  assert.equal(world.root.attributes["data-mokly-theme"], "auto");
  assert.equal(world.stored(), null, "Auto removed the override");
});

test("repeated installation is idempotent and each disposes cleanly", () => {
  const world = environment({});
  const first = installAppearance(world.document, world.window);
  const second = installAppearance(world.document, world.window);
  assert.equal(world.listeners.length, 1, "only one system listener is live");
  second.dispose();
  first.dispose();
  assert.equal(world.listeners.length, 0);
});

test("final disposal removes selector listeners before a later installation", () => {
  const world = environment();
  world.attach({ body: true, select: true });
  const first = installAppearance(world.document, world.window);
  const second = installAppearance(world.document, world.window);
  first.refresh();
  second.refresh();
  assert.equal(world.select.handlers.length, 1);
  first.dispose();
  assert.equal(world.select.handlers.length, 1);
  second.dispose();
  assert.equal(world.select.handlers.length, 0);

  const reinstalled = installAppearance(world.document, world.window);
  reinstalled.refresh();
  let applications = 0;
  world.window.onAppearance = () => {
    applications += 1;
  };
  world.select.value = "dark";
  world.select.fire();
  assert.equal(applications, 1);
  assert.equal(world.stored(), "dark");
  reinstalled.dispose();
  world.select.value = "light";
  world.select.fire();
  assert.equal(applications, 1);
  assert.equal(world.stored(), "dark");
});

test("a document that has not opted in is left untouched", () => {
  const world = environment({ search: "?scheme=dark", opted: false });
  const handle = installAppearance(world.document, world.window);
  assert.equal(world.root.attributes["data-mokly-theme"], undefined);
  assert.equal(world.listeners.length, 0);
  handle.dispose();
});

test("the stored key is the documented origin-local one", () => {
  assert.equal(APPEARANCE_STORAGE_KEY, "mokly:theme");
});

test("repeated handles share one theme, listener and storage", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ frames: [dual] });
  const first = installAppearance(world.document, world.window);
  const second = installAppearance(world.document, world.window);
  assert.equal(world.listeners.length, 1, "only one system listener is live");

  // A choice through either handle is the document's choice, so the shared
  // listener must see it rather than a copy the other handle still holds.
  second.choose("light");
  assert.equal(world.root.attributes["data-mokly-theme"], "light");
  assert.equal(world.stored(), "light");
  world.media.matches = true;
  for (const listener of world.listeners) listener.handler();
  assert.deepEqual(dual.loads, [], "an explicit choice followed the system");

  first.choose("auto");
  assert.equal(world.root.attributes["data-mokly-theme"], "auto");
  assert.equal(world.stored(), null);
  for (const listener of world.listeners) listener.handler();
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
});

test("the shared listener survives until the last handle is disposed", () => {
  const world = environment({});
  const first = installAppearance(world.document, world.window);
  const second = installAppearance(world.document, world.window);
  second.dispose();
  assert.equal(world.listeners.length, 1, "one handle still holds it");
  first.choose("dark");
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  first.dispose();
  assert.equal(world.listeners.length, 0);
  // A disposed handle must not keep writing to a document it no longer owns.
  first.choose("light");
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
});

test("a storage failure never loses the choice the reader made", () => {
  const world = environment({ failStorage: true });
  const handle = installAppearance(world.document, world.window);
  handle.choose("dark");
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  handle.choose("light");
  assert.equal(world.root.attributes["data-mokly-theme"], "light");
});

test("the root is set before the body exists, and the rest follows later", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ search: "?scheme=dark" });
  // At head time there is no body and no frame yet, so only the root can be
  // marked; the appearance must still be right before the first paint.
  const handle = installAppearance(world.document, world.window);
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  assert.equal(world.body.attributes["data-mokly-color-scheme"], undefined);

  world.attach({ frames: [dual], body: true, select: true });
  handle.refresh();
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "dark");
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  assert.equal(world.select.value, "dark", "the control shows the appearance");
  assert.equal(world.select.hidden, false, "the control is revealed");
});

test("choosing through the control applies and stores the appearance", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({});
  const handle = installAppearance(world.document, world.window);
  world.attach({ frames: [dual], body: true, select: true });
  handle.refresh();
  world.select.value = "dark";
  world.select.fire();
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "dark");
  assert.equal(world.stored(), "dark");
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
});

test("a light-only catalogue never captions a fallback under Dark", () => {
  const lightOnly = frame("details.html");
  const world = environment({ search: "?scheme=dark" });
  const handle = installAppearance(world.document, world.window);
  world.attach({ frames: [lightOnly], body: true, select: true });
  handle.refresh();
  // The frame keeps its source, and the body still reports dark, so the
  // fallback caption rule keys off the frame rather than the appearance.
  assert.deepEqual(lightOnly.loads, []);
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "dark");
});

test("the control names the appearance it set", () => {
  const environmentUnderTest = environment({ stored: "dark" });
  environmentUnderTest.attach({ body: true, select: true });
  const handle = installAppearance(
    environmentUnderTest.document,
    environmentUnderTest.window,
  );
  handle.refresh();
  // The visible glyph and word are chosen from this value, so a stale one
  // would leave the control naming an appearance the document is not in.
  assert.equal(
    environmentUnderTest.select.attributes["data-appearance-value"],
    "dark",
  );
  assert.equal(environmentUnderTest.select.value, "dark");

  handle.choose("light");
  assert.equal(
    environmentUnderTest.select.attributes["data-appearance-value"],
    "light",
  );
});
