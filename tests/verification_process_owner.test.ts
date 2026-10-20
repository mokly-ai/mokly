import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { createVerificationProcessOwner } from "../scripts/verification/process-owner.mjs";
import { serveProcess } from "../scripts/verification/serve-process.mjs";

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

for (const depth of [1, 2])
  test(`owner cleanup tolerates a removed sibling with ${depth} descendant levels`, async (context) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-owner-race-"));
    const parent = await createVerificationProcessOwner({ cwd: root, env: {} });
    context.after(async () => {
      await parent.dispose();
      await fs.rm(root, { force: true, recursive: true });
    });
    const inherited = parent.environment({});
    const actor = await createVerificationProcessOwner({ env: inherited });
    const sibling = await createVerificationProcessOwner({ env: inherited });
    let child = sibling;
    const descendants: string[] = [];
    for (let level = 0; level < depth; level += 1) {
      child = await createVerificationProcessOwner({
        env: child.environment({}),
      });
      descendants.unshift(
        `owner-${child.environment({}).MOKLY_VERIFICATION_OWNER_ID}.json`,
      );
    }
    const registry = inherited.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
    const { captured, release } = holdRegistryScan(
      context,
      registry,
      descendants,
    );
    const disposal = actor.dispose();
    try {
      await captured.promise;
      await sibling.dispose();
      await assert.rejects(
        fs.access(child.environment({}).MOKLY_VERIFICATION_RESOURCE_ROOT!),
        { code: "ENOENT" },
      );
    } finally {
      release.resolve();
      await disposal;
    }
    await assert.rejects(
      fs.access(actor.environment({}).MOKLY_VERIFICATION_RESOURCE_ROOT!),
      { code: "ENOENT" },
    );
    await fs.access(inherited.MOKLY_VERIFICATION_RESOURCE_ROOT!);
  });

test("owner cleanup tolerates a sibling process unregistered during the scan", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-process-race-"));
  const parent = await createVerificationProcessOwner({ cwd: root, env: {} });
  const actor = await createVerificationProcessOwner({
    env: parent.environment({}),
  });
  const managed = await serveProcess(
    ["--eval", "process.exit(0)"],
    root,
    parent.environment(),
  );
  const closed = once(managed.child, "close");
  context.after(async () => {
    await managed.drain();
    await closed;
    await parent.dispose();
    await fs.rm(root, { force: true, recursive: true });
  });
  const registry = parent.environment({}).MOKLY_VERIFICATION_PROCESS_REGISTRY!;
  const processes = (await fs.readdir(registry)).filter((name) =>
    name.startsWith("process-"),
  );
  assert.equal(processes.length, 1);
  const { captured, release } = holdRegistryScan(context, registry, processes);
  const disposal = actor.dispose();
  try {
    await captured.promise;
    await managed.drain();
    await closed;
    await assert.rejects(fs.access(path.join(registry, processes[0]!)), {
      code: "ENOENT",
    });
  } finally {
    release.resolve();
    await disposal;
  }
  await fs.access(parent.environment({}).MOKLY_VERIFICATION_RESOURCE_ROOT!);
});

for (const defect of ["missing-parent", "missing-owner", "cycle"] as const)
  test(`persistent ${defect} corruption still retains owner resources`, async (context) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-owner-corrupt-"),
    );
    context.after(() => fs.rm(root, { force: true, recursive: true }));
    const owner = await createVerificationProcessOwner({ cwd: root, env: {} });
    const env = owner.environment({});
    const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY!;
    const first = randomUUID();
    const second = randomUUID();
    const record =
      defect === "missing-owner"
        ? {
            schemaVersion: 1,
            type: "process",
            ownerId: first,
            processGroupId: Number.MAX_SAFE_INTEGER,
          }
        : { schemaVersion: 1, type: "owner", ownerId: first, parentId: second };
    const name = `${record.type}-${first}.json`;
    await fs.writeFile(path.join(registry, name), JSON.stringify(record));
    if (defect === "cycle")
      await fs.writeFile(
        path.join(registry, `owner-${second}.json`),
        JSON.stringify({
          schemaVersion: 1,
          type: "owner",
          ownerId: second,
          parentId: first,
        }),
      );
    const message =
      defect === "missing-parent"
        ? /has no parent/
        : defect === "missing-owner"
          ? /has no owner/
          : /ancestry is cyclic/;
    await assert.rejects(owner.dispose(), message);
    await fs.access(env.MOKLY_VERIFICATION_RESOURCE_ROOT!);
    await fs.access(path.join(registry, name));
  });

/** Capture the selected records, then pause before reading their ancestors. */
function holdRegistryScan(
  context: TestContext,
  registry: string,
  first: string[],
) {
  const readFile = fs.readFile;
  const readdir = fs.readdir;
  const captured = latch();
  const release = latch();
  context.after(() => release.resolve());
  context.mock.method(fs, "readdir", async (directory: string) => {
    const names = await readdir(directory);
    return directory === registry
      ? [
          ...first.filter((name) => names.includes(name)),
          ...names.filter((name) => !first.includes(name)),
        ]
      : names;
  });
  let held = false;
  context.mock.method(
    fs,
    "readFile",
    async (file: string, encoding: "utf8") => {
      const contents = await readFile(file, encoding);
      if (!held && file === path.join(registry, first.at(-1)!)) {
        held = true;
        captured.resolve();
        await release.promise;
      }
      return contents;
    },
  );
  return { captured, release };
}

function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
