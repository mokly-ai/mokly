import assert from "node:assert/strict";
import test from "node:test";

import { gitBlobHash } from "../dist/registry/blob_hash.js";
import { equalBaseDocuments } from "../dist/review/equal_documents.js";

import { currentManifest } from "./helpers/current_manifest.js";

for (const optional of [false, true]) {
  test(`equal-document reuse retains strict batch completeness (optional=${optional})`, async () => {
    const reader = equalBaseDocuments(
      {
        read: async () => Buffer.from("must not mask an omitted batch entry"),
        readIfExists: async () => undefined,
        readMany: async () => new Map(),
        readManyIfExists: async () => new Map(),
      },
      currentManifest({
        entries: [],
        generatedBy: "mokly" as const,
        sourceFiles: [],
      }),
      new Map(),
    );
    await assert.rejects(
      optional
        ? reader.readManyIfExists!(["required.css"])
        : reader.readMany!(["required.css"]),
      { code: "review-invalid" },
    );
  });
}

for (const algorithm of ["sha1", "sha256"] as const) {
  test(`equal accepted ${algorithm} document bytes avoid base I/O without substituting resources`, async () => {
    const bytes = Buffer.from("<html>same</html>");
    const manifest = {
      ...currentManifest({
        entries: [],
        generatedBy: "mokly" as const,
        sourceFiles: [],
      }),
      blobHashAlgorithm: algorithm,
      generatedFiles: [
        { path: "same/index.html", blobHash: gitBlobHash(bytes, algorithm) },
        {
          path: "changed/index.html",
          blobHash: gitBlobHash(Buffer.from("old"), algorithm),
        },
        { path: "styles/theme.css", blobHash: gitBlobHash(bytes, algorithm) },
      ],
    };
    const calls: string[] = [];
    const reader = equalBaseDocuments(
      {
        read: async (route) => {
          calls.push(route);
          return Buffer.from("base");
        },
      },
      manifest,
      new Map([
        ["same/index.html", bytes],
        ["changed/index.html", Buffer.from("new")],
        ["styles/theme.css", bytes],
      ]),
    );
    assert.deepEqual(
      await reader.read("mokly-generated/same/index.html"),
      bytes,
    );
    assert.deepEqual(calls, []);
    assert.deepEqual(
      await reader.read("mokly-generated/changed/index.html"),
      Buffer.from("base"),
    );
    assert.deepEqual(
      await reader.read("mokly-generated/styles/theme.css"),
      Buffer.from("base"),
    );
    assert.deepEqual(calls, [
      "mokly-generated/changed/index.html",
      "mokly-generated/styles/theme.css",
    ]);
  });
}
