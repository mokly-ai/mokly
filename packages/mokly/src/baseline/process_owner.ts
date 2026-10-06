import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Environment key naming the current verification owner's identity. */
export const VERIFICATION_OWNER_ID_ENV = "MOKLY_VERIFICATION_OWNER_ID";

/** Environment key naming the inherited process-registration directory. */
export const VERIFICATION_PROCESS_REGISTRY_ENV =
  "MOKLY_VERIFICATION_PROCESS_REGISTRY";

/** Environment key naming the current verification owner's resource root. */
export const VERIFICATION_RESOURCE_ROOT_ENV =
  "MOKLY_VERIFICATION_RESOURCE_ROOT";

/** One process registration retained until its owning scope has drained. */
export interface ProcessOwnerRegistration {
  dispose(): void;
}

/** Register independently grouped processes with an inherited verifier. */
export interface ProcessOwnerRegistrar {
  register(processGroupId: number): ProcessOwnerRegistration;
}

/** File-backed registrar shared with an ancestor verification wrapper. */
export class InheritedProcessOwnerRegistrar implements ProcessOwnerRegistrar {
  constructor(
    private readonly environment: Readonly<
      Record<string, string | undefined>
    > = process.env,
  ) {}

  register(processGroupId: number): ProcessOwnerRegistration {
    if (!Number.isSafeInteger(processGroupId) || processGroupId <= 0)
      throw new Error("Process ownership requires a positive process group ID");
    const registry = this.environment[VERIFICATION_PROCESS_REGISTRY_ENV];
    const ownerId = this.environment[VERIFICATION_OWNER_ID_ENV];
    const resourceRoot = this.environment[VERIFICATION_RESOURCE_ROOT_ENV];
    if (!registry && !ownerId && !resourceRoot) return NO_REGISTRATION;
    if (!registry || !ownerId || !resourceRoot)
      throw new Error("Verification process ownership is incomplete");
    assertOwnerId(ownerId);
    assertRealDirectory(registry, "process registry");
    assertRealDirectory(resourceRoot, "resource root");
    assertOwnerOpen(registry, ownerId);
    const identity = randomUUID();
    const target = path.join(registry, `process-${identity}.json`);
    const temporary = path.join(
      registry,
      `.process-${identity}-${process.pid}.tmp`,
    );
    let committed = false;
    try {
      fs.writeFileSync(
        temporary,
        `${JSON.stringify({
          schemaVersion: 1,
          type: "process",
          ownerId,
          processGroupId,
        })}\n`,
        { flag: "wx", mode: 0o600 },
      );
      fs.renameSync(temporary, target);
      committed = true;
      assertOwnerOpen(registry, ownerId);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      if (committed) fs.rmSync(target, { force: true });
      throw error;
    }
    return new FileProcessOwnerRegistration(target);
  }
}

class FileProcessOwnerRegistration implements ProcessOwnerRegistration {
  private disposed = false;

  constructor(private readonly file: string) {}

  dispose(): void {
    if (this.disposed) return;
    fs.rmSync(this.file, { force: true });
    this.disposed = true;
  }
}

const NO_REGISTRATION: ProcessOwnerRegistration = { dispose() {} };

function assertOwnerId(ownerId: string): void {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(ownerId))
    throw new Error("Verification owner identity is invalid");
}

function assertRealDirectory(directory: string, label: string): void {
  if (!path.isAbsolute(directory))
    throw new Error(`Verification ${label} must be absolute`);
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error(`Verification ${label} must be a real directory`);
}

function assertOwnerOpen(registry: string, ownerId: string): void {
  const visited = new Set<string>();
  let current: string | null = ownerId;
  while (current !== null) {
    if (visited.has(current))
      throw new Error(`Verification owner ancestry is cyclic: ${current}`);
    visited.add(current);
    if (fs.existsSync(path.join(registry, `closing-${current}`)))
      throw new Error(`Verification process owner is closing: ${current}`);
    const file = path.join(registry, `owner-${current}.json`);
    let value: unknown;
    try {
      value = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(
        `Invalid verification ownership record: ${path.basename(file)}`,
        {
          cause: error,
        },
      );
    }
    current = ownerParent(value, current, file);
  }
}

function ownerParent(
  value: unknown,
  ownerId: string,
  file: string,
): string | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("type" in value) ||
    value.type !== "owner" ||
    !("ownerId" in value) ||
    value.ownerId !== ownerId ||
    !("parentId" in value) ||
    (value.parentId !== null && typeof value.parentId !== "string") ||
    value.parentId === ownerId
  )
    throw new Error(
      `Invalid verification owner record: ${path.basename(file)}`,
    );
  if (value.parentId !== null) assertOwnerId(value.parentId);
  return value.parentId;
}
