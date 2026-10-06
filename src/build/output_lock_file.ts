/** Lock-file operations: exclusive publication, holder records, reclamation and removal. */
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { errorMessage, MoklyError } from "../errors.js";

const MAX_LOCK_BYTES = 4096;
const REMOVE = { force: true, maxRetries: 5, retryDelay: 10 } as const;
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Tokens this process is acquiring or holds; any other own-process token is abandoned. */
const ownTokens = new Set<string>();

/** Recorded owner of a lock; absent fields mean the owner cannot be proven. */
export interface LockHolder {
  readonly pid?: number;
  readonly token?: string;
}

/** Keep only a positive process id and a lowercase UUID token. */
function parseLockHolder(text: string): LockHolder {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null) return {};
  const { pid, token } = value as { pid?: unknown; token?: unknown };
  return {
    ...(typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0
      ? { pid }
      : {}),
    ...(typeof token === "string" && TOKEN.test(token) ? { token } : {}),
  };
}

/** Create the lock file exclusively and return its token, or nothing when held. */
export async function publishLock(file: string): Promise<string | undefined> {
  const token = randomUUID();
  ownTokens.add(token);
  try {
    const handle = await createExclusively(file);
    if (!handle) {
      ownTokens.delete(token);
      return undefined;
    }
    try {
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, token })}\n`,
      );
    } catch (error) {
      await handle.close().catch(() => {});
      await fs.rm(file, REMOVE);
      throw error;
    }
    await handle.close();
    return token;
  } catch (error) {
    ownTokens.delete(token);
    throw error;
  }
}

/**
 * Open the lock file exclusively inside a real `locks/` directory. Releases
 * never remove that directory, so no other writer can remove it mid-create.
 */
async function createExclusively(
  file: string,
): Promise<fs.FileHandle | undefined> {
  const directory = path.dirname(file);
  try {
    await fs.mkdir(directory, { recursive: true }).catch((error: unknown) => {
      if (!hasCode(error, "EEXIST")) throw error;
    });
    if (!(await fs.lstat(directory)).isDirectory())
      throw new MoklyError(
        "build-invalid",
        `generated-output lock directory must be a real directory: ${directory}`,
      );
    return await fs.open(file, "wx");
  } catch (error) {
    if (hasCode(error, "EEXIST") || pendingDeletion(error)) return undefined;
    throw error;
  }
}

/** Read the recorded holder, or nothing when the lock disappeared meanwhile. */
export async function readLockHolder(
  file: string,
): Promise<LockHolder | undefined> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    if (hasCode(error, "ENOENT") || pendingDeletion(error)) return undefined;
    throw error;
  }
  try {
    if (!(await handle.stat()).isFile())
      throw new MoklyError(
        "build-invalid",
        `generated-output lock is not a regular file: ${file}`,
      );
    const buffer = Buffer.alloc(MAX_LOCK_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MAX_LOCK_BYTES, 0);
    return parseLockHolder(buffer.subarray(0, bytesRead).toString("utf8"));
  } finally {
    await handle.close();
  }
}

/** Only a recorded holder that provably stopped may lose its lock. */
export function isAbandoned(holder: LockHolder): boolean {
  if (holder.pid === undefined || holder.token === undefined) return false;
  if (holder.pid === process.pid) return !ownTokens.has(holder.token);
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch (error) {
    return hasCode(error, "ESRCH");
  }
}

/**
 * Retire an abandoned lock through a token-named link, so concurrent reclaimers
 * cannot remove a successor's lock that appeared after they read the holder.
 */
export async function reclaimLock(
  file: string,
  holder: LockHolder,
): Promise<boolean> {
  const retired = `${file}.retired-${holder.token}`;
  try {
    await fs.link(file, retired);
  } catch (error) {
    if (
      hasCode(error, "EEXIST") ||
      hasCode(error, "ENOENT") ||
      pendingDeletion(error)
    )
      return false;
    throw new MoklyError(
      "build-invalid",
      `could not reclaim the generated-output lock left by stopped process ${holder.pid}: ${errorMessage(error)}. Delete ${file} and retry.`,
      { cause: error },
    );
  }
  try {
    if ((await readLockHolder(retired))?.token !== holder.token) return false;
    await fs.rm(file, REMOVE);
    return true;
  } finally {
    await fs.rm(retired, REMOVE);
  }
}

/**
 * Remove only this token's lock file. `locks/` and `.mokly-cache/` stay, so a
 * release never races another writer's create inside them; APFS fails such a
 * create with `EINVAL` rather than `ENOENT`. A failed lock removal is left for
 * the next writer, which reclaims it after this holder stops.
 */
export async function removeLock(file: string, token: string): Promise<void> {
  try {
    if ((await readLockHolder(file))?.token === token)
      await fs.rm(file, REMOVE);
  } catch {
    return;
  } finally {
    ownTokens.delete(token);
  }
}

/** Windows reports a lock that another writer is deleting as `EPERM`. */
function pendingDeletion(error: unknown): boolean {
  return process.platform === "win32" && hasCode(error, "EPERM");
}

function hasCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === code;
}
