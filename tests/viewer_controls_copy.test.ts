import assert from "node:assert/strict";
import test from "node:test";

import { CONTROLS_COPY as DESIGN } from "../examples/basic/specs/design/components/controls/parts/copy.js";
import { CONTROLS_COPY as VIEWER } from "../packages/viewer/dist/shell/component_controls_copy.js";

test("the viewer's Props controls use the settled copy of the controls mockups", () => {
  assert.deepEqual(Object.keys(VIEWER).sort(), Object.keys(DESIGN).sort());
  for (const [key, value] of Object.entries(DESIGN)) {
    const shown = VIEWER[key as keyof typeof VIEWER];
    if (typeof value === "function") {
      assert.equal(typeof shown, "function", key);
      for (const title of ["Default", "Welcome"])
        assert.equal((shown as typeof value)(title), value(title), key);
    } else assert.equal(shown, value, key);
  }
});
