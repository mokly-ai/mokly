import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FIXED_SCROLL_TOGETHER,
  memoryScrollTogether,
  parseScrollTogether,
  SCROLL_TOGETHER_STORAGE_KEY,
  storedScrollTogether,
  type PreferenceStorage,
} from "../src/shell/comparison_scroll_preference.js";

/** An origin store that records every access and can refuse them. */
function store(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SCROLL_TOGETHER_STORAGE_KEY, initial);
  const state = { refuseReads: false, refuseWrites: false };
  const storage: PreferenceStorage = {
    getItem(key) {
      if (state.refuseReads) throw new Error("blocked");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (state.refuseWrites) throw new Error("blocked");
      values.set(key, value);
    },
  };
  return { state, storage, values };
}

test("only an exact off turns Scroll together off", () => {
  assert.equal(parseScrollTogether("off"), false);
  for (const value of ["on", null, undefined, "", "OFF", " off", "false"])
    assert.equal(parseScrollTogether(value), true, String(value));
});

test("the standalone choice is read from and written to origin storage", () => {
  assert.equal(SCROLL_TOGETHER_STORAGE_KEY, "mokly:comparison-scroll-together");
  const saved = store("off");
  const preference = storedScrollTogether(() => saved.storage);
  assert.equal(preference.read(), false);
  let heard = 0;
  const stop = preference.subscribe(() => (heard += 1));
  preference.write(true);
  assert.equal(preference.read(), true);
  assert.equal(saved.values.get(SCROLL_TOGETHER_STORAGE_KEY), "on");
  preference.write(true);
  assert.equal(heard, 1, "an unchanged choice notifies nobody");
  preference.write(false);
  assert.equal(saved.values.get(SCROLL_TOGETHER_STORAGE_KEY), "off");
  stop();
  preference.write(true);
  assert.equal(heard, 2);
});

test("missing, invalid and unreadable choices mean on", () => {
  assert.equal(storedScrollTogether(() => store().storage).read(), true);
  assert.equal(storedScrollTogether(() => store("maybe").storage).read(), true);
  const blocked = store("off");
  blocked.state.refuseReads = true;
  assert.equal(storedScrollTogether(() => blocked.storage).read(), true);
  assert.equal(
    storedScrollTogether(() => {
      throw new Error("no storage");
    }).read(),
    true,
  );
  assert.equal(storedScrollTogether(() => undefined).read(), true);
});

test("a refused write keeps the choice for the open document", () => {
  const saved = store();
  saved.state.refuseWrites = true;
  const preference = storedScrollTogether(() => saved.storage);
  assert.doesNotThrow(() => preference.write(false));
  assert.equal(preference.read(), false);
  assert.equal(saved.values.has(SCROLL_TOGETHER_STORAGE_KEY), false);
});

test("an embedded viewer's choice lives only in its mount", () => {
  const first = memoryScrollTogether();
  const second = memoryScrollTogether();
  assert.equal(first.read(), true);
  first.write(false);
  assert.equal(first.read(), false);
  assert.equal(second.read(), true, "independent roots, independent choices");
  assert.equal(FIXED_SCROLL_TOGETHER.read(), true);
  FIXED_SCROLL_TOGETHER.write(false);
  assert.equal(FIXED_SCROLL_TOGETHER.read(), true);
});
