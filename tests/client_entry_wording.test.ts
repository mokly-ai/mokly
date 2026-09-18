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
