import assert from "node:assert/strict";
import { test } from "node:test";

import { count } from "../src/count/count.js";

test("a count takes the singular noun for one and the plural otherwise", () => {
  assert.deepEqual(
    [
      count(1, "instance"),
      count(3, "instance"),
      count(0, "view"),
      count(1, "nested instance"),
    ],
    ["1 instance", "3 instances", "0 views", "1 nested instance"],
  );
});
