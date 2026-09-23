import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  assertOwnerOpen,
  assertOwnerId,
  assertRealDirectory,
  beginOwnerClosure,
  drainOwnedProcesses,
  removeOwnedOwnerRecords,
  terminateOwnedProcesses,
  writeOwnerRecord,
  writeProcessRecord,
} from "./process-owner-records.mjs";

export const VERIFICATION_OWNER_ID_ENV = "MOKLY_VERIFICATION_OWNER_ID";
export const VERIFICATION_PROCESS_REGISTRY_ENV =
  "MOKLY_VERIFICATION_PROCESS_REGISTRY";
export const VERIFICATION_RESOURCE_ROOT_ENV =
  "MOKLY_VERIFICATION_RESOURCE_ROOT";

export async function createVerificationProcessOwner(options = {}) {
  const environment = options.env ?? process.env;
  const inherited = await inheritedOwner(environment);
  const ownerId = randomUUID();
  let registry;
  let resourceRoot;
  let rootDirectory;
  if (inherited) {
    registry = inherited.registry;
    resourceRoot = path.join(inherited.resourceRoot, "owners", ownerId);
  } else {
    const contextRoot = path.join(
      path.resolve(options.cwd ?? process.cwd()),
      ".context",
    );
    await fs.mkdir(contextRoot, { recursive: true });
    rootDirectory = await fs.mkdtemp(
      path.join(contextRoot, "verification-owner-"),
    );
    registry = path.join(rootDirectory, "registry");
    resourceRoot = path.join(rootDirectory, "resources", ownerId);
  }
  let recordWritten = false;
  try {
    await Promise.all([
      fs.mkdir(registry, { recursive: true }),
      fs.mkdir(resourceRoot, { recursive: true }),
    ]);
    if (inherited) await assertOwnerOpen(registry, inherited.ownerId);
    await writeOwnerRecord(registry, ownerId, inherited?.ownerId ?? null);
    recordWritten = true;
    if (inherited) await assertOwnerOpen(registry, ownerId);
  } catch (error) {
    try {
      await cleanupFailedOwner({
        ownerId,
        recordWritten,
        registry,
        resourceRoot,
        rootDirectory,
      });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "verification owner creation and cleanup failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }
  return new VerificationProcessOwner({
    ownerId,
    registry,
    resourceRoot,
    rootDirectory,
  });
}

class VerificationProcessOwner {
  #closed = false;
  #disposal;

  constructor(options) {
    this.ownerId = options.ownerId;
    this.registry = options.registry;
    this.resourceRoot = options.resourceRoot;
    this.rootDirectory = options.rootDirectory;
  }

  environment(base = process.env) {
    return {
      ...base,
      [VERIFICATION_OWNER_ID_ENV]: this.ownerId,
      [VERIFICATION_PROCESS_REGISTRY_ENV]: this.registry,
      [VERIFICATION_RESOURCE_ROOT_ENV]: this.resourceRoot,
    };
  }

  terminate(signal) {
    try {
      this.#beginClosure();
      return terminateOwnedProcesses(this.registry, this.ownerId, signal);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  registerProcessGroup(processGroupId) {
    if (this.#closed)
      throw new Error(`Verification process owner is closing: ${this.ownerId}`);
    return writeProcessRecord(this.registry, this.ownerId, processGroupId);
  }

  dispose() {
    if (!this.#disposal) {
      try {
        this.#beginClosure();
        this.#disposal = this.#disposeOnce();
      } catch (error) {
        this.#disposal = Promise.reject(error);
      }
    }
    return this.#disposal;
  }

  #beginClosure() {
    if (this.#closed) return;
    beginOwnerClosure(this.registry, this.ownerId);
    this.#closed = true;
  }

  async #disposeOnce() {
    await this.terminate("SIGKILL");
    await drainOwnedProcesses(this.registry, this.ownerId);
    await fs.rm(this.resourceRoot, { force: true, recursive: true });
    if (this.rootDirectory) {
      await fs.rm(this.rootDirectory, { force: true, recursive: true });
      return;
    }
    await removeOwnedOwnerRecords(this.registry, this.ownerId);
  }
}

async function inheritedOwner(environment) {
  const registry = environment[VERIFICATION_PROCESS_REGISTRY_ENV];
  const ownerId = environment[VERIFICATION_OWNER_ID_ENV];
  const resourceRoot = environment[VERIFICATION_RESOURCE_ROOT_ENV];
  if (!registry && !ownerId && !resourceRoot) return;
  if (!registry || !ownerId || !resourceRoot)
    throw new Error("Inherited verification process ownership is incomplete");
  assertOwnerId(ownerId);
  await Promise.all([
    assertRealDirectory(registry, "process registry"),
    assertRealDirectory(resourceRoot, "resource root"),
  ]);
  return { ownerId, registry, resourceRoot };
}

async function cleanupFailedOwner(options) {
  const removals = options.rootDirectory
    ? [fs.rm(options.rootDirectory, { force: true, recursive: true })]
    : [
        fs.rm(options.resourceRoot, { force: true, recursive: true }),
        ...(options.recordWritten
          ? [
              fs.rm(
                path.join(options.registry, `owner-${options.ownerId}.json`),
                { force: true },
              ),
            ]
          : []),
      ];
  const failures = (await Promise.allSettled(removals))
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "verification owner cleanup failed");
}
