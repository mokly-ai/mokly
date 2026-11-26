import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveInstanceId,
  resolveWrapperInstanceId,
} from "../packages/mokly/src/authoring/instance-names.js";

test("story use naming takes the first usable key or default naming prop", () => {
  for (const [key, props, id] of [
    ["  Café / SAVE _ now!  ", { id: "ignored" }, "button-cafe-save-now"],
    [42, { id: "ignored" }, "button-42"],
    [" ", { id: "primary", name: "later" }, "button-primary"],
    [
      undefined,
      { id: "👋", name: "menu", "data-testid": "later" },
      "button-menu",
    ],
    [Infinity, { id: false, name: "", "data-testid": "test" }, "button-test"],
    [
      false,
      { "data-testid": "!!!", "aria-label": "Číslo 5" },
      "button-cislo-5",
    ],
    [null, { id: "", name: NaN, "aria-label": "--" }, "button"],
  ] as const) {
    assert.deepEqual(resolveInstanceId("button", new Set(), key, props), {
      id,
      numbered: false,
    });
  }
});

test("story use naming respects custom and empty lists and ignores key and empty items", () => {
  const props = {
    id: "default",
    key: "prop",
    qa: "custom",
    name: "other",
    "": "empty",
  };
  for (const [key, names, id] of [
    [undefined, [], "button"],
    [7, [], "button-7"],
    [undefined, ["key", "", "qa", "name"], "button-custom"],
    ["manual", ["qa", "key"], "button-manual"],
  ] as const) {
    assert.deepEqual(
      resolveInstanceId("button", new Set(), key, props, names),
      { id, numbered: false },
    );
  }
});

test("story use naming fills the first available suffix after a collision", () => {
  const seen = new Set<string>();
  for (const [key, id, numbered] of [
    [3, "button-3", false],
    [undefined, "button", false],
    [undefined, "button-2", true],
    [undefined, "button-4", true],
    [2, "button-2-2", true],
    [2, "button-2-3", true],
  ] as const) {
    const result = resolveInstanceId("button", seen, key, {});
    assert.deepEqual(result, { id, numbered });
    seen.add(result.id);
  }
});

test("wrapper naming prefers moklyInstance to key and the path segment", () => {
  for (const [explicit, key, id] of [
    ["manual", "ignored", "manual"],
    [undefined, "Café / Save", "Button_Icon-cafe-save"],
    [undefined, 7, "Button_Icon-7"],
    [undefined, "!!!", "Button_Icon"],
  ] as const) {
    assert.deepEqual(
      resolveWrapperInstanceId("Button_Icon", new Set(), explicit, key),
      { id, numbered: false },
    );
  }
  assert.throws(
    () => resolveWrapperInstanceId("Button_Icon", new Set(), "Not valid", 7),
    /moklyInstance must be lowercase kebab-case/u,
  );
});

test("wrappers and story uses number collisions in the same scope", () => {
  const seen = new Set(["button-3"]);
  const first = resolveWrapperInstanceId("button", seen, undefined, undefined);
  assert.deepEqual(first, { id: "button", numbered: false });
  seen.add(first.id);
  const story = resolveInstanceId("button", seen, undefined, {});
  assert.deepEqual(story, { id: "button-2", numbered: true });
  seen.add(story.id);
  const wrapper = resolveWrapperInstanceId(
    "button",
    seen,
    undefined,
    undefined,
  );
  assert.deepEqual(wrapper, { id: "button-4", numbered: true });
  seen.add(wrapper.id);
  assert.deepEqual(resolveWrapperInstanceId("button", seen, undefined, 2), {
    id: "button-2-2",
    numbered: true,
  });
});
