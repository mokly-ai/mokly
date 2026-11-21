import assert from "node:assert/strict";
import test from "node:test";

import { instanceBoxSizes } from "../src/shell/instance_box_model.js";

test("box sizes round each shown length after deriving and clamping content", () => {
  assert.deepEqual(
    instanceBoxSizes({
      box: { x: 1, y: 2, width: 40.4, height: 10.4 },
      border: { top: 2.2, right: 1.4, bottom: 2.2, left: 1.4 },
      padding: { top: 2.5, right: 3.4, bottom: 4.5, left: 3.4 },
    }),
    {
      width: 40,
      height: 10,
      padding: { top: 3, right: 3, bottom: 5, left: 3 },
      contentWidth: 31,
      contentHeight: 0,
    },
  );
});
