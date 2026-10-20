import assert from "node:assert/strict";
import test from "node:test";

import { entryWording } from "../packages/viewer/dist/client/entry_wording.js";

test("entry wording keeps screen copy and recasts it for a saved view", () => {
  const screen = entryWording("screen");
  assert.equal(
    screen.label("Styles this screen uses changed"),
    "Styles this screen uses changed",
  );
  assert.equal(screen.label("Screen changed"), "Screen changed");
  assert.equal(screen.noChanges, "No changes to this screen.");

  const component = entryWording("component");
  assert.equal(
    component.label("Styles this screen uses changed"),
    "Styles this variant uses changed",
  );
  assert.equal(component.label("Screen changed"), "Variant changed");
  assert.equal(component.noChanges, "No changes to this saved view.");
});

test("a component recasts each stage label for its variant", () => {
  const component = entryWording("component");
  for (const [screen, variant] of [
    ["Screen changed", "Variant changed"],
    ["No changes to this screen", "No changes to this variant"],
    ["New screen", "New variant"],
    ["Screen removed", "Variant removed"],
    ["Only excluded content changed", "Only excluded content changed"],
  ] as const)
    assert.equal(component.label(screen), variant);
});
