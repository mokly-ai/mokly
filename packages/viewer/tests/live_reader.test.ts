import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readLiveDescriptor,
  RENDER_ROUTE,
} from "../src/catalogue/live_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

const GENERATION = "c".repeat(64);

function descriptor(): Record<string, unknown> {
  return {
    schemaVersion: 3,
    generation: GENERATION,
    render: { url: "/mokly-viewer/components/render", token: "opaque" },
  };
}

function rejects(
  edit: (value: Record<string, unknown>) => void,
  reason: RegExp,
) {
  const value = descriptor();
  edit(value);
  assert.throws(
    () => readLiveDescriptor(value),
    (error) =>
      !(error instanceof MoklyVersionError) &&
      error instanceof Error &&
      reason.test(error.message),
  );
}

test("the live descriptor names the render generation and one render route", () => {
  assert.deepEqual(readLiveDescriptor(descriptor()), descriptor());
  assert.equal(RENDER_ROUTE, "/mokly-viewer/components/render");
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

test("the render capability is exact", () => {
  rejects((value) => {
    (value.render as Record<string, unknown>).url =
      "https://elsewhere.test/mokly-viewer/components/render";
  }, /invalid render capability/);
  rejects((value) => {
    (value.render as Record<string, unknown>).token = "";
  }, /invalid render capability/);
  rejects((value) => {
    (value.render as Record<string, unknown>).method = "POST";
  }, /render\.method: unknown field/);
  rejects((value) => {
    value.revision = 1;
  }, /live\.revision: unknown field/);
  rejects((value) => {
    value.generation = "short";
  }, /invalid identity/);
});
