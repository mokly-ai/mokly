import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue, MoklyVersionError } from "@mokly/viewer";
import { parseStaticDelivery } from "@mokly/viewer/data";
import { readLiveShellBootstrapState } from "@mokly/viewer/runtime";

import { legacyCatalogueGate } from "./helpers/legacy_catalogue_gate.js";

test("the legacy v3 catalogue gate rejects v4 before any entry or path read", () => {
  assert.throws(
    () =>
      legacyCatalogueGate({
        schemaVersion: 4,
        get screens(): never {
          throw new Error("Unexpected entry read");
        },
        get comparisonUrl(): never {
          throw new Error("Unexpected path read");
        },
      }),
    /unsupported schemaVersion/u,
  );
});

for (const [boundary, supported, read] of [
  ["catalogue", 4, readCatalogue],
  ["delivery", 4, parseStaticDelivery],
  ["bootstrap", 1, readLiveShellBootstrapState],
] as const) {
  test(`${boundary} rejects unsupported versions before consuming payload fields`, () => {
    for (const version of [
      undefined,
      ...Array.from({ length: supported }, (_, index) => index),
      supported + 1,
      String(supported),
    ]) {
      const value = {
        schemaVersion: version,
        get context(): never {
          throw new Error("Unexpected payload read");
        },
        get entries(): never {
          throw new Error("Unexpected payload read");
        },
      };
      assert.throws(
        () => read(value),
        (error: unknown) => {
          assert.ok(error instanceof MoklyVersionError);
          assert.equal(error.boundary, boundary);
          assert.equal(
            error.message,
            `Unsupported Mokly ${boundary} version ${version}; this viewer supports version ${supported}.`,
          );
          return true;
        },
      );
    }
  });
}
