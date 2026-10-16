import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { serveProcess } from "../scripts/verification/serve-process.mjs";

test("Serve starts only after registration and drains its registered process group", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-serve-scope-"));
  const managed = await serveProcess(
    ["--eval", "process.stdout.write('ready\\n');setInterval(()=>{},1000)"],
    root,
  ).catch(async (error: unknown) => {
    await fs.rm(root, { recursive: true, force: true });
    throw error;
  });
  context.after(async () => {
    await managed.drain();
    await fs.rm(root, { recursive: true, force: true });
  });
  const inherited = process.env["MOKLY_VERIFICATION_PROCESS_REGISTRY"];
  const registry =
    inherited ??
    path.join(
      root,
      ".context",
      (await fs.readdir(path.join(root, ".context")))[0]!,
      "registry",
    );
  const candidates = (await fs.readdir(registry)).filter((name) =>
    name.startsWith("process-"),
  );
  const records = [];
  for (const name of candidates) {
    try {
      const record = JSON.parse(
        await fs.readFile(path.join(registry, name), "utf8"),
      );
      if (record.processGroupId === managed.child.pid) records.push(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  assert.equal(records.length, 1);
  const record = JSON.parse(
    await fs.readFile(path.join(registry, records[0]!), "utf8"),
  );
  assert.equal(record.processGroupId, managed.child.pid);
  const data = once(managed.child.stdout!, "data", {
    signal: AbortSignal.timeout(15_000),
  });
  const closed = once(managed.child, "close", {
    signal: AbortSignal.timeout(15_000),
  });
  await managed.start();
  assert.equal(String((await data)[0]), "ready\n");
  await managed.drain();
  await closed;
  await managed.drain();
  await assert.rejects(fs.access(path.join(registry, records[0]!)), {
    code: "ENOENT",
  });
  if (!inherited) await assert.rejects(fs.access(registry), { code: "ENOENT" });
});
