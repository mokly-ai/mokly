/** Compare real assertion diagnostics and caller lines across guard modes. */
import assert, { equal } from "node:assert/strict";
import test from "node:test";

test("diagnostic", async () => {
  switch (process.env.MOKLY_GUARD_SCENARIO) {
    case "ok":
      assert.ok(5 < 3);
      break;
    case "named":
      equal(1, 2, "named sentinel");
      break;
    case "direct":
      assert(false, "direct sentinel");
      break;
    case "rejects":
      await assert.rejects(Promise.resolve());
      break;
    default:
      assert.equal(1, 2, "method sentinel");
  }
});
