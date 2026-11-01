import assert from "node:assert/strict";
import { test } from "node:test";

import { environment } from "./appearance_fixture.js";

test("route pins update the whole appearance without storing a preference", async (t) => {
  const world = await environment(t, { stored: "light" });
  await world.start();
  await world.navigate("dark");
  assert.equal(world.theme(), "dark");
  assert.equal(world.scheme(), "dark");
  assert.equal(world.select().value, "dark");
  for (const frame of world.frames()) assert.match(frame.src, /\.dark\.html/);
  assert.equal(world.stored(), "light");
  await world.navigate();
  assert.equal(world.theme(), "dark");
  await world.navigate("light");
  assert.equal(world.theme(), "light");
});

test("reader choices outrank later route pins even without storage", async (t) => {
  for (const theme of ["light", "auto", "dark"] as const) {
    const world = await environment(t, {
      search: "?scheme=dark",
      failStorage: true,
    });
    await world.start();
    await world.choose(theme);
    for (const pin of ["light", "dark", undefined] as const) {
      await world.navigate(pin);
      assert.equal(world.theme(), theme);
    }
    await world.exit();
    assert.equal(world.theme(), theme);
    await world.dispose();
  }
});

test("Auto continues to follow the system after a conflicting route pin", async (t) => {
  const world = await environment(t, { search: "?scheme=dark" });
  await world.start();
  await world.choose("auto");
  await world.navigate("dark");
  assert.equal(world.theme(), "auto");
  assert.equal(world.scheme(), "light");
  await world.system(true);
  assert.equal(world.theme(), "auto");
  assert.equal(world.scheme(), "dark");
});

test("React appearance changes keep one mounted frame owner", async (t) => {
  const world = await environment(t);
  await world.start();
  const frames = world.frames();
  const schemes: string[] = [];
  await world.choose("dark");
  schemes.push(world.scheme() ?? "missing");
  await world.choose("auto");
  schemes.push(world.scheme() ?? "missing");
  await world.system(true);
  schemes.push(world.scheme() ?? "missing");
  assert.deepEqual(schemes, ["dark", "light", "dark"]);
  assert.deepEqual(world.frames(), frames);
});
