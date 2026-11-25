import assert from "node:assert/strict";
import test from "node:test";

import { resolveInstanceId } from "../packages/mokly/src/authoring/instance-names.js";

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
