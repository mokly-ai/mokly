import { createHash } from "node:crypto";
import fs from "node:fs/promises";

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
  try {
    const handle = await fs.open(file, "r");
    try {
      if (!(await handle.stat()).isFile())
        throw new Error("not a regular file");
      const hash = createHash("sha256");
      for await (const bytes of handle.createReadStream({
        highWaterMark: 64 * 1024,
        autoClose: false,
      }))
        hash.update(bytes);
      return hash.digest("hex");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (missingFile(error)) return null;
    throw error;
  }
}

/** Four workers bound both open handles and the memory used by streaming checks. */
export async function everyInput<T>(
  values: readonly T[],
  check: (value: T) => Promise<boolean>,
): Promise<boolean> {
  let index = 0;
  let matches = true;
  await Promise.all(
    Array.from({ length: Math.min(4, values.length) }, async () => {
      while (matches && index < values.length) {
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
