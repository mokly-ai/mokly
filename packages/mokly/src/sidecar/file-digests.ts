import { createHash } from "node:crypto";
import fs from "node:fs";

import { cooperativeYield } from "./cooperative-yield.js";

const digestBuffer = Buffer.allocUnsafe(64 * 1024);
const INPUT_WORKERS = 4;

/** Only a missing candidate is absence. Permission and other read failures are errors. */
export function missingFile(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["ENOENT", "ENOTDIR"].includes(String(error.code))
  );
}

/** Hash an opened file with a fixed 64 KiB buffer, independent of its length. */
export async function fileDigest(file: string): Promise<string | null> {
  return digestFile(file, digestBuffer, false);
}

function firstRead(handle: number, buffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.read(handle, buffer, 0, buffer.length, null, (error, length) => {
      if (error) reject(error);
      else resolve(length);
    });
  });
}

async function digestFile(
  file: string,
  buffer: Buffer,
  overlapFirstRead: boolean,
): Promise<string | null> {
  const pause = cooperativeYield();
  if (pause) await pause;
  try {
    const handle = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
    );
    try {
      if (!fs.fstatSync(handle).isFile()) throw new Error("not a regular file");
      const hash = createHash("sha256");
      let first = overlapFirstRead;
      for (;;) {
        const length = first
          ? await firstRead(handle, buffer)
          : fs.readSync(handle, buffer, 0, buffer.length, null);
        first = false;
        if (!length) break;
        hash.update(buffer.subarray(0, length));
        const pause = cooperativeYield();
        if (pause) await pause;
      }
      return hash.digest("hex");
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (missingFile(error)) return null;
    throw error;
  }
}

/** Keep consumed module digests when metadata adds the same file again. */
export async function metadataDigest(
  file: string,
  inputs: Readonly<Record<string, string | null>>,
  bytes?: Uint8Array,
): Promise<string | null> {
  const pause = cooperativeYield();
  if (pause) await pause;
  return (
    inputs[file] ??
    (bytes === undefined
      ? await fileDigest(file)
      : createHash("sha256").update(bytes).digest("hex"))
  );
}

/** Reuse owns four reusable buffers while the first reads wait for the filesystem. */
export async function currentFileInputs(
  inputs: Readonly<Record<string, string | null>>,
): Promise<boolean> {
  const values = Object.entries(inputs);
  const buffers = Array.from(
    { length: Math.min(INPUT_WORKERS, values.length) },
    () => Buffer.allocUnsafe(digestBuffer.length),
  );
  return everyInput(values, async ([file, expected]) => {
    const buffer = buffers.pop()!;
    try {
      return (await digestFile(file, buffer, true)) === expected;
    } finally {
      buffers.push(buffer);
    }
  });
}

/** Four workers bound in-flight checks and share the cooperative yield budget. */
export async function everyInput<T>(
  values: readonly T[],
  check: (value: T) => Promise<boolean>,
): Promise<boolean> {
  let index = 0;
  let matches = true;
  await Promise.all(
    Array.from({ length: Math.min(INPUT_WORKERS, values.length) }, async () => {
      while (matches && index < values.length) {
        const pause = cooperativeYield();
        if (pause) await pause;
        if (!matches || index >= values.length) break;
        const value = values[index++]!;
        try {
          if (!(await check(value))) matches = false;
        } catch {
          matches = false;
        }
      }
    }),
  );
  return matches;
}
