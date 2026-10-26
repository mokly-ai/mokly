import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";

import { consumer, serve } from "./helpers/mokly_serve.js";

async function groupRecords(registry: string, pid: number) {
  const records = [];
  for (const name of await fs.readdir(registry)) {
    if (!name.startsWith("process-") || !name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(
        await fs.readFile(path.join(registry, name), "utf8"),
      );
      if (record.processGroupId === pid) records.push(record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return records;
}

test("the Serve test helper drains its registered group before completion", async (context) => {
  const root = await consumer(context, {
    "specs/home.screen.html": "---\ntitle: Home\n---\n<h1>Home</h1>",
  });
  const owner = await createVerificationProcessOwner({ cwd: root });
  const env = owner.environment();
  const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
  let running: Awaited<ReturnType<typeof serve>> | undefined;
  try {
    running = await serve(context, root, env);
    await running.ready();
    const records = await groupRecords(registry, running.child.pid!);
    assert.equal(records.length, 1);
    assert.equal(records[0].schemaVersion, 1);
    assert.notEqual(records[0].ownerId, env.MOKLY_VERIFICATION_OWNER_ID);
    await running.close();
    await fs.access(registry);
    assert.deepEqual(await groupRecords(registry, running.child.pid!), []);
  } finally {
    await running?.close();
    await owner.dispose();
  }
});
