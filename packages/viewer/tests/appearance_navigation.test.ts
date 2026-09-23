import assert from "node:assert/strict";
import { test } from "node:test";

import { installAppearance } from "../src/standalone/startup.js";

import { environment, frame } from "./appearance_fixture.js";

test("route pins update the whole appearance without storing a preference", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ stored: "light", frames: [dual] });
  world.attach({ body: true, select: true, frames: [dual] });
  const handle = installAppearance(world.document, world.window);
  handle.applyRoute("dark");
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "dark");
  assert.equal(world.select.value, "dark");
  assert.deepEqual(dual.loads, ["welcome.dark.html"]);
  assert.equal(world.stored(), "light");
  handle.applyRoute(undefined);
  assert.equal(world.root.attributes["data-mokly-theme"], "dark");
  handle.applyRoute("light");
  assert.equal(world.root.attributes["data-mokly-theme"], "light");
});

test("reader choices outrank later route pins even without storage", () => {
  for (const theme of ["light", "auto", "dark"] as const) {
    const world = environment({ search: "?scheme=dark", failStorage: true });
    const handle = installAppearance(world.document, world.window);
    handle.choose(theme);
    for (const pin of ["light", "dark", undefined] as const) {
      handle.applyRoute(pin);
      assert.equal(world.root.attributes["data-mokly-theme"], theme);
    }
    handle.dispose();
    handle.applyRoute("dark");
    assert.equal(world.root.attributes["data-mokly-theme"], theme);
  }
});

test("Auto continues to follow the system after a conflicting route pin", () => {
  const world = environment({ search: "?scheme=dark" });
  world.attach({ body: true });
  const handle = installAppearance(world.document, world.window);
  handle.choose("auto");
  handle.applyRoute("dark");
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "light");
  world.media.matches = true;
  for (const listener of world.listeners) listener.handler();
  assert.equal(world.root.attributes["data-mokly-theme"], "auto");
  assert.equal(world.body.attributes["data-mokly-color-scheme"], "dark");
});

test("a hydrated appearance host exclusively owns live fragment navigation", () => {
  const dual = frame("welcome.html", "welcome.dark.html");
  const world = environment({ frames: [dual] });
  const handle = installAppearance(world.document, world.window);
  const schemes: string[] = [];
  world.window.onAppearance = (_theme, scheme) => schemes.push(scheme);
  handle.choose("dark");
  handle.choose("auto");
  world.media.matches = true;
  for (const listener of world.listeners) listener.handler();
  assert.deepEqual(schemes, ["dark", "light", "dark"]);
  assert.deepEqual(
    dual.loads,
    [],
    "startup must not create iframe history after the host takes ownership",
  );
});
