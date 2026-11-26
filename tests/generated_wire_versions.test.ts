import assert from "node:assert/strict";
import test from "node:test";

import {
  MoklyVersionError,
  readCatalogueIndex,
  readEntryDetail,
} from "@mokly/viewer";

import { readLiveDescriptor } from "../packages/viewer/dist/catalogue/live_reader.js";

for (const [boundary, supported, read] of [
  ["catalogue", 9, readCatalogueIndex],
  ["detail", 4, readEntryDetail],
  ["live", 3, readLiveDescriptor],
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
        get identity(): never {
          throw new Error("Unexpected payload read");
        },
        get generation(): never {
          throw new Error("Unexpected payload read");
        },
        get render(): never {
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
