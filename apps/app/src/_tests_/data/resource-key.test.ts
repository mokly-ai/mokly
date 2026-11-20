import assert from "node:assert/strict";
import { test } from "node:test";

import { unexpectedError } from "../../api/errors";
import { resourceForKey } from "../../data/resource-key";
import type { Resource } from "../../data/use-resource";

test("a changed key hides both the previous value and the previous error", () => {
  const states: Resource<string>[] = [
    { status: "ready", value: "whole URL" },
    { status: "error", error: unexpectedError() },
  ];
  for (const state of states) {
    assert.deepEqual(resourceForKey("screen", { key: "whole", state }), {
      status: "loading",
    });
  }
});
