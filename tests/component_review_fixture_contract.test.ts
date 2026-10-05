import assert from "node:assert/strict";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";

import { componentGit } from "./helpers/component_review_fixture.js";

test("component Git fixtures reject missing text and binary documents", async () => {
  const outputs = new Map<string, string | Uint8Array>([
    ["asset.bin", new Uint8Array([0, 255])],
  ]);
  const compilation: Compilation = {
    manifest: {
      schemaVersion: 7,
      generatedBy: "mokly",
      entries: [],
      sourceFiles: [],
    },
    outputs,
    deliveredStyleSources: [],
  };
  const reader = componentGit(compilation).reader;
  await assert.rejects(
    reader.readFile("baseline", "mockups/missing.html"),
    /Missing fixture: mockups\/missing\.html/u,
  );
  await assert.rejects(
    reader.readFile("baseline", "mockups/asset.bin"),
    /generated document is not text: mockups\/asset\.bin/u,
  );
});
