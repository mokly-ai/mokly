import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readThemeChoice,
  themeChoiceKey,
  writeThemeChoice,
} from "../../theme/choice";
import { memoryStorage, withWindow } from "../page-window";

/** Every item a storage holds, as key and value pairs. */
function items(storage: Storage): [string, string | null][] {
  return Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index) ?? "";
    return [key, storage.getItem(key)];
  });
}

test("the device keeps no Theme until the reader chooses one", () => {
  const localStorage = memoryStorage();
  withWindow({ localStorage }, () => {
    assert.equal(readThemeChoice(), undefined);
  });
  assert.deepEqual(items(localStorage), []);
});

test("a choice is one item on the device, and the next choice replaces it", () => {
  const localStorage = memoryStorage();
  withWindow({ localStorage }, () => {
    writeThemeChoice("dark");
    assert.deepEqual(items(localStorage), [[themeChoiceKey, "dark"]]);
    assert.equal(readThemeChoice(), "dark");
    writeThemeChoice("light");
    assert.deepEqual(items(localStorage), [[themeChoiceKey, "light"]]);
    assert.equal(readThemeChoice(), "light");
  });
});

test("a stored value that names no scheme is no choice", () => {
  for (const value of ["blue", "Dark", "", "auto"]) {
    const localStorage = memoryStorage();
    localStorage.setItem(themeChoiceKey, value);
    withWindow({ localStorage }, () => {
      assert.equal(readThemeChoice(), undefined, JSON.stringify(value));
    });
  }
});

test("storage that refuses the read or the write keeps no choice and throws nothing", () => {
  withWindow({ localStorage: memoryStorage(true) }, () => {
    assert.doesNotThrow(() => writeThemeChoice("dark"));
    assert.equal(readThemeChoice(), undefined);
  });
  // A browser that blocks storage throws from `window.localStorage` itself.
  const blocked = {
    get localStorage(): Storage {
      throw new Error("storage blocked");
    },
  };
  withWindow(blocked, () => {
    assert.doesNotThrow(() => writeThemeChoice("light"));
    assert.equal(readThemeChoice(), undefined);
  });
  withWindow(undefined, () => {
    assert.doesNotThrow(() => writeThemeChoice("light"));
    assert.equal(readThemeChoice(), undefined);
  });
});
