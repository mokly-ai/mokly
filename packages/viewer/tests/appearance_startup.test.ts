import assert from "node:assert/strict";
import { test } from "node:test";

import {
  installAppearance,
  type AppearanceDocument,
  type AppearanceWindow,
} from "../src/standalone/startup.js";
import { APPEARANCE_STORAGE_KEY } from "../src/standalone/preference.js";

interface FakeFrame {
  src: string;
  dataset: Record<string, string | undefined>;
  loads: string[];
}

function frame(light: string, dark?: string): FakeFrame {
  const element: FakeFrame = {
    src: light,
    dataset: dark ? { fragmentLight: light, fragmentDark: dark } : {},
    loads: [],
  };
  return new Proxy(element, {
    set(target, key, value) {
      if (key === "src") target.loads.push(String(value));
      return Reflect.set(target, key, value);
    },
  });
}

function environment(
  options: {
    search?: string;
    stored?: string | null;
    initial?: string;
    systemDark?: boolean;
    frames?: FakeFrame[];
    opted?: boolean;
  } = {},
) {
  const root: { attributes: Record<string, string> } = { attributes: {} };
  const listeners: { type: string; handler: () => void }[] = [];
  const media = {
    matches: options.systemDark ?? false,
    addEventListener(type: string, handler: () => void) {
      listeners.push({ type, handler });
    },
    removeEventListener(type: string, handler: () => void) {
      const index = listeners.findIndex((entry) => entry.handler === handler);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  let value = options.stored ?? null;
  const document = {
    documentElement: {
      getAttribute: (name: string) => root.attributes[name] ?? null,
      setAttribute: (name: string, next: string) => {
        root.attributes[name] = next;
      },
      dataset: options.opted === false ? {} : { moklyAppearance: "" },
    },
    querySelectorAll: () => options.frames ?? [],
  } as unknown as AppearanceDocument;
  const window = {
    location: { search: options.search ?? "" },
    matchMedia: () => media,
    localStorage: {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next;
      },
      removeItem: () => {
        value = null;
      },
    },
  } as unknown as AppearanceWindow;
  if (options.initial) root.attributes["data-mokly-theme"] = options.initial;
  return { document, window, root, listeners, media, stored: () => value };
}

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
