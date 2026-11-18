import type { BigIntStats } from "node:fs";
import fs from "node:fs/promises";

/** Only the fields used to verify a capture, with no integer precision loss. */
export type CaptureStat = Pick<
  BigIntStats,
  | "dev"
  | "ino"
  | "ctimeNs"
  | "mtimeNs"
  | "size"
  | "isDirectory"
  | "isFile"
  | "isSymbolicLink"
>;

/** Read-only filesystem and realtime boundary of a capture witness. */
export interface CaptureRuntime {
  platform: NodeJS.Platform;
  now(): bigint;
  wait(milliseconds: number): Promise<void>;
  lstat(file: string): Promise<CaptureStat>;
  stat(file: string): Promise<CaptureStat>;
  readlink(file: string): Promise<string>;
  handleStat(file: string): Promise<CaptureStat>;
  filesystem(file: string): Promise<bigint>;
}

export const captureRuntime: CaptureRuntime = {
  platform: process.platform,
  now: () => BigInt(Date.now()) * 1_000_000n,
  wait: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  lstat: (file) => fs.lstat(file, { bigint: true }),
  stat: (file) => fs.stat(file, { bigint: true }),
  readlink: (file) => fs.readlink(file),
  // Affected libuv path-stat layouts read the wrong Windows device bytes.
  // Handle stats query the volume directly and preserve its real serial.
  handleStat: async (file) => {
    const handle = await fs.open(file, "r");
    try {
      return await handle.stat({ bigint: true });
    } finally {
      await handle.close();
    }
  },
  filesystem: async (file) => (await fs.statfs(file, { bigint: true })).type,
};

function sameStamp(
  before: CaptureStat,
  actual: CaptureStat,
  metadata: boolean,
): boolean {
  return (
    actual.ino === before.ino &&
    actual.ctimeNs === before.ctimeNs &&
    actual.mtimeNs === before.mtimeNs &&
    (!metadata || actual.size === before.size)
  );
}

function samePathStat(
  before: CaptureStat,
  actual: CaptureStat,
  metadata: boolean,
): boolean {
  return (
    sameStamp(before, actual, metadata) &&
    actual.isDirectory() === before.isDirectory() &&
    actual.isFile() === before.isFile() &&
    actual.isSymbolicLink() === before.isSymbolicLink()
  );
}

export function sameCaptureStat(
  before: CaptureStat,
  actual: CaptureStat,
  metadata: boolean,
): boolean {
  return actual.dev === before.dev && sameStamp(before, actual, metadata);
}

/** Windows handles supply dev; path reads retain the requested link semantics. */
export async function captureSnapshot(
  runtime: CaptureRuntime,
  file: string,
  stat: CaptureStat,
  follow: boolean,
  metadata: boolean,
): Promise<CaptureStat> {
  if (runtime.platform !== "win32") return stat;
  if (metadata ? !stat.isFile() : !stat.isDirectory())
    throw new Error("capture witness kind changed");
  const opened = await runtime.handleStat(file);
  const after = await (follow ? runtime.stat(file) : runtime.lstat(file));
  if (
    !samePathStat(stat, opened, metadata) ||
    !samePathStat(after, opened, metadata)
  )
    throw new Error("capture path changed while opening its witness");
  return opened;
}

/** Whole-second filesystems need a guard that crosses two timestamp ticks. */
export function maturityGuard(stat: CaptureStat): bigint {
  return stat.ctimeNs % 1_000_000_000n === 0n &&
    stat.mtimeNs % 1_000_000_000n === 0n
    ? 2_100_000_000n
    : 50_000_000n;
}

export function mature(stat: CaptureStat, now: bigint): boolean {
  return (
    stat.ctimeNs > 0n &&
    stat.mtimeNs > 0n &&
    stat.ctimeNs <= now &&
    stat.mtimeNs <= now &&
    now - stat.ctimeNs >= maturityGuard(stat)
  );
}
