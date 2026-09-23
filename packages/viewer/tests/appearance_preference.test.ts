import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APPEARANCE_STORAGE_KEY,
  effectiveScheme,
  readStoredAppearance,
  resolveAppearance,
  schemePin,
  storeAppearance,
  type AppearanceStorage,
} from "../src/standalone/preference.js";

/** A storage that records calls and can fail the way a blocked origin does. */
function fakeStorage(options: {
  value?: string | null;
  failOn?: "read" | "write" | "remove";
}): AppearanceStorage & { calls: string[]; value: string | null } {
  const state = {
    calls: [] as string[],
    value: options.value ?? null,
    getItem(key: string) {
      state.calls.push(`get:${key}`);
      if (options.failOn === "read") throw new Error("blocked");
      return state.value;
    },
    setItem(key: string, value: string) {
      state.calls.push(`set:${key}=${value}`);
      if (options.failOn === "write") throw new Error("blocked");
      state.value = value;
    },
    removeItem(key: string) {
      state.calls.push(`remove:${key}`);
      if (options.failOn === "remove") throw new Error("blocked");
      state.value = null;
    },
  };
  return state;
}

test("the URL pin accepts only an explicit scheme", () => {
  for (const [search, expected] of [
    ["?scheme=dark", "dark"],
    ["?scheme=light", "light"],
    ["?scheme=auto", undefined],
    ["?scheme=DARK", undefined],
    ["?scheme=", undefined],
    ["?other=dark", undefined],
    ["", undefined],
  ] as const)
    assert.equal(schemePin(search), expected, search || "(no query)");
});

test("only an explicit stored value is accepted", () => {
  for (const [stored, expected] of [
    ["dark", "dark"],
    ["light", "light"],
    ["auto", undefined],
    ["Dark", undefined],
    ["{}", undefined],
    ["", undefined],
    [null, undefined],
  ] as const)
    assert.equal(
      readStoredAppearance(fakeStorage({ value: stored })),
      expected,
      JSON.stringify(stored),
    );
});

test("a storage that refuses to be read reports no preference", () => {
  const storage = fakeStorage({ value: "dark", failOn: "read" });
  assert.equal(readStoredAppearance(storage), undefined);
  assert.deepEqual(storage.calls, [`get:${APPEARANCE_STORAGE_KEY}`]);
});

test("an explicit choice is stored and Auto removes the override", () => {
  const storage = fakeStorage({ value: "dark" });
  storeAppearance(storage, "light");
  assert.equal(storage.value, "light");
  storeAppearance(storage, "auto");
  assert.equal(storage.value, null);
  assert.deepEqual(storage.calls, [
    `set:${APPEARANCE_STORAGE_KEY}=light`,
    `remove:${APPEARANCE_STORAGE_KEY}`,
  ]);
});

test("a storage that refuses to be written leaves navigation working", () => {
  for (const failOn of ["write", "remove"] as const) {
    const storage = fakeStorage({ failOn });
    assert.doesNotThrow(() =>
      storeAppearance(storage, failOn === "write" ? "dark" : "auto"),
    );
  }
});

test("a full load resolves the pin, then storage, then the initial theme", () => {
  assert.equal(
    resolveAppearance({ pin: "dark", stored: "light", initial: "light" }),
    "dark",
  );
  assert.equal(
    resolveAppearance({ stored: "light", initial: "dark" }),
    "light",
  );
  assert.equal(resolveAppearance({ initial: "dark" }), "dark");
  assert.equal(resolveAppearance({}), "auto");
});

test("a selection wins for the document, even with no storage", () => {
  assert.equal(
    resolveAppearance({ chosen: "light", pin: "dark", stored: "dark" }),
    "light",
  );
  assert.equal(resolveAppearance({ chosen: "auto", pin: "dark" }), "auto");
});

test("Auto reads the system; an explicit choice ignores it", () => {
  for (const systemDark of [true, false]) {
    assert.equal(effectiveScheme("dark", systemDark), "dark");
    assert.equal(effectiveScheme("light", systemDark), "light");
    assert.equal(
      effectiveScheme("auto", systemDark),
      systemDark ? "dark" : "light",
    );
  }
});
