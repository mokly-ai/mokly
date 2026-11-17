import type { BigIntStats } from "node:fs";
import fs from "node:fs/promises";

/** Only the fields used to verify a capture, with no integer precision loss. */
export type CaptureStat = Pick<
  BigIntStats,
  "dev" | "ino" | "ctimeNs" | "mtimeNs" | "size" | "isDirectory"
>;

/** Read-only filesystem and realtime boundary of a capture witness. */
export interface CaptureRuntime {
  platform: NodeJS.Platform;
  now(): bigint;
  wait(milliseconds: number): Promise<void>;
  lstat(file: string): Promise<CaptureStat>;
  stat(file: string): Promise<CaptureStat>;
  filesystem(file: string): Promise<bigint>;
}

export const captureRuntime: CaptureRuntime = {
  platform: process.platform,
  now: () => BigInt(Date.now()) * 1_000_000n,
  wait: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  lstat: (file) => fs.lstat(file, { bigint: true }),
  stat: (file) => fs.stat(file, { bigint: true }),
  filesystem: async (file) => (await fs.statfs(file, { bigint: true })).type,
};

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
