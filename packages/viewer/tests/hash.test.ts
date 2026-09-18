import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { sha256 } from "../src/data/sha256.js";

test("browser hashing preserves Node digests, Unicode and block boundaries", () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, 127, 128, 1000, 10000]) {
    for (const text of ["a", "é", "😀", "\ud800", "\0"]) {
      const value = text.repeat(length);
      assert.equal(
        sha256(value),
        createHash("sha256").update(value).digest("hex"),
      );
    }
  }
});
