import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue, MoklyVersionError } from "@mokly/viewer";
import { parseStaticDelivery } from "@mokly/viewer/data";
import { readLiveShellBootstrapState } from "@mokly/viewer/runtime";

for (const [boundary, supported, read] of [
  ["catalogue", 4, readCatalogue],
  ["delivery", 4, parseStaticDelivery],
  ["bootstrap", 1, readLiveShellBootstrapState],
] as const) {
  test(`${boundary} rejects unsupported versions before consuming payload fields`, () => {
    for (const version of [undefined, 0, supported - 1, supported + 1]) {
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
