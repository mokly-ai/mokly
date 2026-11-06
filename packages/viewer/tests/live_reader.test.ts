import assert from "node:assert/strict";
import { test } from "node:test";

import { readLiveDescriptor } from "../src/catalogue/live_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

const GENERATION = "c".repeat(64);

function descriptor(): Record<string, unknown> {
  return {
    schemaVersion: 3,
    generation: GENERATION,
    render: { url: "/mokly-viewer/components/render", token: "opaque" },
  };
}

test("the live descriptor names the render generation and one render route", () => {
  const value = descriptor();
  const copy = readLiveDescriptor(value);
  assert.deepEqual(copy, value);
  assert.notStrictEqual(copy, value);
  assert.notStrictEqual(copy.render, value.render);
});

test("the live version gate runs before any other field is read", () => {
  for (const value of [
    undefined,
    {},
    { ...descriptor(), schemaVersion: 2 },
    { schemaVersion: 4, render: "not a capability" },
  ])
    assert.throws(
      () => readLiveDescriptor(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "live" &&
        error.supported === 3,
    );
});
