import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, act } from "@testing-library/react";

import { environment } from "./appearance_fixture.js";

test("startup assigns each preview's browser context before its first source", async (t) => {
  const world = await environment(t, { search: "?scheme=dark" });
  await world.start();
  const frames = world.frames();
  assert.ok(frames.length > 0);
  for (const frame of frames) {
    assert.equal(
      frame
        .closest("[data-preview-color-scheme]")
        ?.getAttribute("data-preview-color-scheme"),
      "dark",
    );
    assert.match(frame.src, /\.dark\.html/);
  }
  await world.choose("light");
  for (const frame of world.frames()) {
    assert.equal(
      frame
        .closest("[data-preview-color-scheme]")
        ?.getAttribute("data-preview-color-scheme"),
      "light",
    );
  }
});

test("the effective appearance is applied to the document root", async (t) => {
  for (const [options, expected] of [
    [{ search: "?scheme=dark" }, "dark"],
    [{ stored: "light", systemDark: true }, "light"],
    [{ initial: "dark" }, "dark"],
    [{}, "auto"],
  ] as const) {
    const world = await environment(t, options);
    await world.start();
    assert.equal(world.theme(), expected, JSON.stringify(options));
    await world.dispose();
  }
});

test("a pin outranks storage and is never saved", async (t) => {
  const world = await environment(t, {
    search: "?scheme=light",
    stored: "dark",
  });
  await world.start();
  assert.equal(world.theme(), "light");
  assert.equal(world.stored(), "dark", "the pin did not overwrite the choice");
});

test("a dark start mounts the dark sources once and repeated mounting is inert", async (t) => {
  const world = await environment(t, { search: "?scheme=dark" });
  await world.start();
  const frames = world.frames();
  const sources = frames.map((frame) => frame.src);
  assert.ok(sources.length > 0);
  for (const source of sources) assert.match(source, /\.dark\.html/);
  await world.start();
  assert.deepEqual(world.frames(), frames);
  assert.deepEqual(
    world.frames().map((frame) => frame.src),
    sources,
  );
});

test("restoration keeps frames whose sources already match", async (t) => {
  const world = await environment(t, { search: "?scheme=dark" });
  await world.start();
  const frames = world.frames();
  const sources = frames.map((frame) => frame.getAttribute("src"));
  await world.restore();
  assert.deepEqual(world.frames(), frames);
  assert.deepEqual(
    world.frames().map((frame) => frame.getAttribute("src")),
    sources,
  );
});

test("a light start mounts light sources directly", async (t) => {
  const world = await environment(t, { search: "?scheme=light" });
  await world.start();
  assert.equal(world.scheme(), "light");
  assert.ok(world.frames().length > 0);
  for (const frame of world.frames())
    assert.doesNotMatch(frame.src, /\.dark\.html/);
});

test("Auto follows a system change while the document is open", async (t) => {
  const world = await environment(t);
  await world.start();
  assert.equal(world.theme(), "auto");
  await world.system(true);
  assert.equal(world.scheme(), "dark");
  await world.dispose();
  assert.equal(world.listeners.size, 0, "cleanup removed every listener");
});

test("an explicit choice ignores a system change", async (t) => {
  const world = await environment(t, { stored: "light" });
  await world.start();
  const sources = world.frames().map((frame) => frame.src);
  await world.system(true);
  assert.equal(world.scheme(), "light");
  assert.deepEqual(
    world.frames().map((frame) => frame.src),
    sources,
  );
});

test("choosing an appearance applies and stores it, and Auto clears it", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.choose("dark");
  assert.equal(world.theme(), "dark");
  assert.equal(world.stored(), "dark");
  assert.equal(world.scheme(), "dark");
  await world.choose("auto");
  assert.equal(world.theme(), "auto");
  assert.equal(world.stored(), null, "Auto removed the override");
});

test("repeated mounting has one system listener and disposes cleanly", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.start();
  assert.equal(world.listeners.size, 1);
  await world.dispose();
  assert.equal(world.listeners.size, 0);
});

test("final disposal removes change handling before a later mount", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.start();
  const select = world.select();
  await world.choose("dark");
  assert.equal(world.writes(), 1);
  await world.exit();
  assert.equal(world.listeners.size, 0);
  await act(async () =>
    fireEvent.change(select, { target: { value: "light" } }),
  );
  assert.equal(world.writes(), 1);
  assert.equal(world.stored(), "dark");
  await world.start();
  await world.choose("light");
  assert.equal(world.listeners.size, 1);
  assert.equal(world.writes(), 2);
  assert.equal(world.stored(), "light");
});

test("a document without a standalone mount is left untouched", async (t) => {
  const world = await environment(t, { search: "?scheme=dark", opted: false });
  await world.start();
  assert.equal(world.theme(), null);
  assert.equal(world.listeners.size, 0);
});

test("repeated mounts share one theme, listener and storage", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.start();
  assert.equal(world.listeners.size, 1);
  await world.choose("light");
  assert.equal(world.theme(), "light");
  assert.equal(world.stored(), "light");
  await world.system(true);
  assert.equal(world.scheme(), "light");
  await world.choose("auto");
  assert.equal(world.theme(), "auto");
  assert.equal(world.stored(), null);
  assert.equal(world.scheme(), "dark");
});

test("a cached page keeps its listener until the final exit", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.cache();
  assert.equal(world.listeners.size, 1);
  await world.choose("dark");
  assert.equal(world.theme(), "dark");
  await world.exit();
  assert.equal(world.listeners.size, 0);
  assert.equal(world.theme(), "dark");
});

test("a storage failure never loses the choice the reader made", async (t) => {
  const world = await environment(t, { failStorage: true });
  await world.start();
  await world.choose("dark");
  assert.equal(world.theme(), "dark");
  await world.choose("light");
  assert.equal(world.theme(), "light");
});

test("the root is set before frames exist, and the first rendered frames follow", async (t) => {
  const world = await environment(t, { search: "?scheme=dark", pending: true });
  await world.start();
  assert.equal(world.theme(), "dark");
  assert.equal(world.frames().length, 0);
  await world.deliver();
  assert.equal(world.scheme(), "dark");
  assert.ok(world.frames().length > 0);
  for (const frame of world.frames()) assert.match(frame.src, /\.dark\.html/);
  assert.equal(world.select().value, "dark");
  assert.equal(world.select().closest("label")?.hidden, false);
});

test("choosing through the control applies and stores the appearance", async (t) => {
  const world = await environment(t);
  await world.start();
  await world.choose("dark");
  assert.equal(world.theme(), "dark");
  assert.equal(world.scheme(), "dark");
  assert.equal(world.stored(), "dark");
});

test("a light-only page keeps its Light context under Dark", async (t) => {
  const world = await environment(t, {
    search: "?scheme=dark",
    path: "/view/guide/",
  });
  await world.start();
  assert.equal(world.scheme(), "dark");
  assert.equal(world.frames().length, 1);
  assert.equal(
    world
      .frames()[0]
      ?.closest("[data-preview-color-scheme]")
      ?.getAttribute("data-preview-color-scheme"),
    "light",
  );
});

test("the control names the appearance it set", async (t) => {
  const world = await environment(t, { stored: "dark" });
  await world.start();
  assert.equal(
    world.select().closest("label")?.getAttribute("data-appearance-value"),
    "dark",
  );
  assert.equal(world.select().value, "dark");
  await world.choose("light");
  assert.equal(
    world.select().closest("label")?.getAttribute("data-appearance-value"),
    "light",
  );
});
