import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertOwnerOpen,
  writeOwnerRecord,
} from "../scripts/verification/process-owner-records.mjs";
import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";

/**
 * A child owner writes its record after its first open check and checks again
 * after the write. When its parent closes between the two, the child record
 * exists for a moment under a parent whose records are gone, until the child's
 * own cleanup removes it. A scan of the shared registry in that moment must
 * skip the child, because the parent's closing marker names a closed parent.
 */
test("a scan skips a child that its closed parent left during creation", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-owner-close-"));
  const top = await createVerificationProcessOwner({ cwd: root, env: {} });
  context.after(async () => {
    await top.dispose();
    await fs.rm(root, { force: true, recursive: true });
  });
  const inherited = top.environment({});
  const registry = inherited.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
  const parent = await createVerificationProcessOwner({ env: inherited });
  const sibling = await createVerificationProcessOwner({ env: inherited });
  const parentId = parent.environment({}).MOKLY_VERIFICATION_OWNER_ID!;
  const child = randomUUID();
  const childFile = path.join(registry, `owner-${child}.json`);

  // The child's first open check passes, then the parent closes completely.
  await assertOwnerOpen(registry, parentId);
  await parent.dispose();
  // The child writes its record under the parent that is gone.
  await writeOwnerRecord(registry, child, parentId);

  // Another owner's cleanup scans the shared registry in this moment.
  await sibling.dispose();
  await assert.rejects(
    fs.access(sibling.environment({}).MOKLY_VERIFICATION_RESOURCE_ROOT!),
    { code: "ENOENT" },
  );

  // The child's second check finds the closed parent, so its creation fails
  // and its cleanup removes the record.
  await assert.rejects(
    assertOwnerOpen(registry, child),
    /Verification process owner is closing/,
  );
  await fs.rm(childFile);
});
