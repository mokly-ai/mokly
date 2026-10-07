import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseManifest } from "../dist/registry/manifest.js";
import { GENERATED_DIRECTORY } from "../packages/viewer/dist/data.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { auditGeneratedResourceReferences } from "./helpers/generated_resource_references.js";

test("generated example documents reference only existing local resources", async () => {
  const root = path.join(repositoryRoot, "examples/basic");
  const generated = path.join(root, GENERATED_DIRECTORY);
  const manifest = parseManifest(
    JSON.parse(
      await fs.readFile(path.join(generated, "mokly-manifest.json"), "utf8"),
    ),
  );
  const generatedFiles = (await fs.readdir(generated, { recursive: true })).map(
    (file) => path.join(GENERATED_DIRECTORY, file),
  );
  const audit = await auditGeneratedResourceReferences(root, [
    ...generatedFiles,
    ...manifest.assetClosure,
  ]);
  assert.deepEqual(audit.failures, []);
  assert.ok(audit.htmlFiles > 0, "the audit read no generated HTML files");
  assert.ok(audit.stylesheetLinks > 0, "the audit read no stylesheet links");
});
