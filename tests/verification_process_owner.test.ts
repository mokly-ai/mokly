import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  InheritedProcessOwnerRegistrar,
  VERIFICATION_OWNER_ID_ENV,
  VERIFICATION_PROCESS_REGISTRY_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV,
} from "../dist/baseline/process_owner.js";
import {
  createVerificationProcessOwner,
  VERIFICATION_OWNER_ID_ENV as SCRIPT_OWNER_ID_ENV,
  VERIFICATION_PROCESS_REGISTRY_ENV as SCRIPT_PROCESS_REGISTRY_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV as SCRIPT_RESOURCE_ROOT_ENV,
} from "../scripts/verification/process-owner.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

test("verification ownership environment keys stay synchronized", () => {
  assert.deepEqual(
    [
      SCRIPT_OWNER_ID_ENV,
      SCRIPT_PROCESS_REGISTRY_ENV,
      SCRIPT_RESOURCE_ROOT_ENV,
    ],
    [
      VERIFICATION_OWNER_ID_ENV,
      VERIFICATION_PROCESS_REGISTRY_ENV,
      VERIFICATION_RESOURCE_ROOT_ENV,
    ],
  );
});

test(
  "nested verification owners isolate sibling processes and resources",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await testRoot(context);
    const environment = cleanEnvironment();
    const parent = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const first = await createVerificationProcessOwner({
      cwd: root,
      env: parent.environment(environment),
    });
    const second = await createVerificationProcessOwner({
      cwd: root,
      env: parent.environment(environment),
    });
    const firstEnvironment = first.environment(environment);
    const secondEnvironment = second.environment(environment);
    const firstResource = firstEnvironment[VERIFICATION_RESOURCE_ROOT_ENV]!;
    const secondResource = secondEnvironment[VERIFICATION_RESOURCE_ROOT_ENV]!;
    await Promise.all([
      fs.writeFile(path.join(firstResource, "owned.txt"), "first"),
      fs.writeFile(path.join(secondResource, "owned.txt"), "second"),
    ]);
    const firstChild = persistentGroup();
    const secondChild = persistentGroup();
    const firstClosed = childClosed(firstChild);
    const secondClosed = childClosed(secondChild);
    const firstRegistration = new InheritedProcessOwnerRegistrar(
      firstEnvironment,
    ).register(firstChild.pid!);
    const secondRegistration = new InheritedProcessOwnerRegistrar(
      secondEnvironment,
    ).register(secondChild.pid!);
    context.after(() => {
      killGroupIfPresent(firstChild.pid);
      killGroupIfPresent(secondChild.pid);
    });

    const firstDisposal = first.dispose();
    assert.equal(first.dispose(), firstDisposal);
    await firstDisposal;
    await firstClosed;
    assert.equal(processGroupExists(firstChild.pid), false);
    assert.equal(processGroupExists(secondChild.pid), true);
    await assert.rejects(fs.access(firstResource), { code: "ENOENT" });
    await fs.access(path.join(secondResource, "owned.txt"));
    firstRegistration.dispose();

    await second.dispose();
    await secondClosed;
    secondRegistration.dispose();
    await parent.dispose();
  },
);

test(
  "normal deregistration and owner disposal are idempotent",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await testRoot(context);
    const environment = cleanEnvironment();
    const owner = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const ownedEnvironment = owner.environment(environment);
    const child = spawn(process.execPath, ["-e", ""], {
      detached: true,
      stdio: "ignore",
    });
    const registration = new InheritedProcessOwnerRegistrar(
      ownedEnvironment,
    ).register(child.pid!);
    await childClosed(child);
    registration.dispose();
    registration.dispose();
    const resourceRoot = ownedEnvironment[VERIFICATION_RESOURCE_ROOT_ENV]!;
    await fs.writeFile(path.join(resourceRoot, "owned.txt"), "owned");

    const disposal = owner.dispose();
    assert.equal(owner.dispose(), disposal);
    await disposal;
    await assert.rejects(fs.access(resourceRoot), { code: "ENOENT" });
  },
);

test(
  "stale process registrations are reclaimed after their group exits",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await testRoot(context);
    const environment = cleanEnvironment();
    const owner = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const ownedEnvironment = owner.environment(environment);
    const child = spawn(process.execPath, ["-e", ""], {
      detached: true,
      stdio: "ignore",
    });
    new InheritedProcessOwnerRegistrar(ownedEnvironment).register(child.pid!);
    await childClosed(child);
    await owner.dispose();
  },
);

test(
  "ancestor shutdown rejects late nested process registrations",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await testRoot(context);
    const environment = cleanEnvironment();
    const parent = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const nested = await createVerificationProcessOwner({
      cwd: root,
      env: parent.environment(environment),
    });
    const child = persistentGroup();
    const closed = childClosed(child);
    let registration:
      ReturnType<InheritedProcessOwnerRegistrar["register"]> | undefined;
    const disposal = parent.dispose();
    try {
      assert.throws(() => {
        registration = new InheritedProcessOwnerRegistrar(
          nested.environment(environment),
        ).register(child.pid!);
      }, /Verification process owner is closing/);
    } finally {
      registration?.dispose();
      killGroupIfPresent(child.pid);
      await closed;
      await disposal;
    }
  },
);

test(
  "parent disposal drains an abandoned nested owner",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await testRoot(context);
    const environment = cleanEnvironment();
    const parent = await createVerificationProcessOwner({
      cwd: root,
      env: environment,
    });
    const nested = await createVerificationProcessOwner({
      cwd: root,
      env: parent.environment(environment),
    });
    const nestedEnvironment = nested.environment(environment);
    const nestedResource = nestedEnvironment[VERIFICATION_RESOURCE_ROOT_ENV]!;
    await fs.writeFile(path.join(nestedResource, "owned.txt"), "nested");
    const child = persistentGroup();
    const closed = childClosed(child);
    const registration = new InheritedProcessOwnerRegistrar(
      nestedEnvironment,
    ).register(child.pid!);
    context.after(() => killGroupIfPresent(child.pid));

    await parent.dispose();
    await closed;
    registration.dispose();
    assert.equal(processGroupExists(child.pid), false);
    await assert.rejects(fs.access(nestedResource), { code: "ENOENT" });
  },
);

test("malformed process registrations retain owner resources", async (context) => {
  const root = await testRoot(context);
  const environment = cleanEnvironment();
  const owner = await createVerificationProcessOwner({
    cwd: root,
    env: environment,
  });
  const ownedEnvironment = owner.environment(environment);
  const registry = ownedEnvironment[VERIFICATION_PROCESS_REGISTRY_ENV]!;
  const resourceRoot = ownedEnvironment[VERIFICATION_RESOURCE_ROOT_ENV]!;
  await fs.writeFile(
    path.join(registry, `process-${randomUUID()}.json`),
    "{}\n",
  );

  await assert.rejects(owner.dispose(), /Invalid verification process record/);
  await fs.access(resourceRoot);
});

async function testRoot(context: test.TestContext): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/verification-owner-test-"),
  );
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return root;
}

function cleanEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[VERIFICATION_OWNER_ID_ENV];
  delete environment[VERIFICATION_PROCESS_REGISTRY_ENV];
  delete environment[VERIFICATION_RESOURCE_ROOT_ENV];
  return environment;
}

function persistentGroup(): ChildProcess {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: true,
    stdio: "ignore",
  });
}

function childClosed(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", () => resolve());
  });
}

function processGroupExists(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function killGroupIfPresent(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
