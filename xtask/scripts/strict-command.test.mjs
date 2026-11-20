import assert from "node:assert/strict";
import test from "node:test";

import { skippedReason } from "./strict-command.mjs";

test("cloud checks reject skips from scripts, Node, Rust, Playwright, and unittest", () => {
  for (const output of [
    "SKIP workload image builds: buildctl is missing",
    "# skipped 1\n# todo 0",
    "test result: ok. 10 passed; 0 failed; 1 ignored; 0 measured;",
    "  2 skipped\n  42 passed",
    "OK (skipped=3)",
    "# skipped 0\n# todo 2",
    "ℹ skipped 1\nℹ todo 0",
    "ℹ skipped 0\nℹ todo 2",
    "  Tests  2 passed | 1 todo (3)",
  ])
    assert.equal(typeof skippedReason(output), "string", output);
  for (const output of [
    "# skipped 0\n# todo 0",
    "ℹ skipped 0\nℹ todo 0",
    "test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured;",
    "  42 passed",
    "test another_product_email_is_skipped_not_failed ... ok",
  ])
    assert.equal(skippedReason(output), null, output);
});
