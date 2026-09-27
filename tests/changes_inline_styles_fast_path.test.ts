import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

for (const mode of ["committed", "derived"] as const)
  for (const [name, before, after] of [
    [
      "excluded cumulative rule",
      "<style>.action{color:red}</style>",
      "<style>.action{color:red}.unused{color:blue}</style>",
    ],
    [
      "owned component rule",
      "<style>.actual-only{color:red}</style>",
      "<style>.actual-only{color:blue}</style>",
    ],
    [
      "formatting-only rule",
      "<style>.action { color: red; }</style>",
      "<style>/* format */.action{color:red}</style>",
    ],
  ] as const)
    test(`${mode} fast and complete comparisons agree for an inline ${name}`, async (t) => {
      const fixture = await inlineChangesFixture(t, before, after);
      const [fast, complete] = await Promise.all([
        fixture.complete(true, mode),
        fixture.complete(false, mode),
      ]);
      assert.deepEqual(fast.result, complete.result);
    });
