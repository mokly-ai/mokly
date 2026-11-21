import assert from "node:assert/strict";
import { test } from "node:test";

import { unexpectedError } from "../../api/errors";
import { isRefreshing, startRead } from "../../data/use-resource";
import type { Resource } from "../../data/use-resource";

const shown: Resource<string> = { status: "ready", value: "on screen" };

test("a read of the same key keeps the value on screen while it refreshes", () => {
  const refreshing = startRead(shown, true);
  assert.deepEqual(refreshing, {
    status: "ready",
    value: "on screen",
    refreshing: true,
  });
  assert.equal(isRefreshing(refreshing), true);
  // A second refresh while the first runs keeps the same value.
  assert.deepEqual(startRead(refreshing, true), refreshing);
});

test("a new key, a failure and a first read start from loading", () => {
  assert.deepEqual(startRead(shown, false), { status: "loading" });
  const failed: Resource<string> = {
    status: "error",
    error: unexpectedError(),
  };
  assert.deepEqual(startRead(failed, true), { status: "loading" });
  assert.deepEqual(startRead<string>({ status: "loading" }, true), {
    status: "loading",
  });
});

test("only a value with a newer read in flight is refreshing", () => {
  assert.equal(isRefreshing(shown), false);
  assert.equal(isRefreshing<string>({ status: "loading" }), false);
  assert.equal(
    isRefreshing<string>({ status: "error", error: unexpectedError() }),
    false,
  );
  assert.equal(isRefreshing(undefined), false);
});
