import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { auditGeneratedResourceReferences } from "./helpers/generated_resource_references.js";

test("generated example documents reference only existing local resources", async () => {
  const audit = await auditGeneratedResourceReferences(
    path.join(repositoryRoot, "examples/basic/generated"),
  );
  assert.deepEqual(audit.failures, []);
  assert.ok(audit.htmlFiles > 0, "the audit read no generated HTML files");
  assert.ok(
    audit.localReferences > 0,
    "the audit checked no local resource references",
  );
});
