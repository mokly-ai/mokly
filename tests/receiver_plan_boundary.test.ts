import assert from "node:assert/strict";
import test from "node:test";

import { plan } from "./helpers/receiver/upload.js";

const endpoint = "https://receiver.example.test/plan";
const response = {
  schemaVersion: 1,
  upload: { id: "session", expiresAt: "2030-01-01T00:00:00.000Z" },
  missing: [],
  blobUrl: "https://receiver.example.test/blobs/{sha256}?token=1#details",
  completeUrl: "https://receiver.example.test/complete#details",
};
const read = (value: unknown) =>
  plan(Buffer.from(JSON.stringify(value)), endpoint, []);

test("independent Plan reader keeps opaque IDs and permits request URL fragments", () => {
  for (const id of ["\u0000\n\u007f", "\ud800", "é".repeat(127) + "a"])
    assert.doesNotThrow(() =>
      read({ ...response, upload: { ...response.upload, id } }),
    );
  for (const id of ["", null, 1, "é".repeat(128)])
    assert.throws(
      () => read({ ...response, upload: { ...response.upload, id } }),
      /invalid/u,
    );
  for (const blobUrl of [
    "https://receiver.example.test/blobs?digest={sha256}",
    "https://receiver.example.test/blobs#{sha256}",
    "https://receiver.example.test/blobs/{sha256}#{sha256}",
  ])
    assert.throws(() => read({ ...response, blobUrl }), /invalid/u);
});
