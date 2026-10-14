import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";

test("malformed process registrations retain owner resources", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-owner-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  const environment = {};
  const owner = await createVerificationProcessOwner({
    cwd: root,
    env: environment,
  });
  const ownedEnvironment = owner.environment(environment);
  const registry = ownedEnvironment.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
  const resourceRoot = ownedEnvironment.MOKLY_VERIFICATION_RESOURCE_ROOT!;
  await fs.writeFile(
    path.join(registry, `process-${randomUUID()}.json`),
    "{}\n",
  );

  await assert.rejects(owner.dispose(), /Invalid verification process record/);
  await fs.access(resourceRoot);
});
