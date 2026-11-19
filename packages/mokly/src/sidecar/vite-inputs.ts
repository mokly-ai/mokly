import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import { fileDigest } from "./file-digests.js";
import type { ViteInputs } from "./vite-plugin.js";

/** A file selected by several queries must contribute the same source bytes. */
export async function recordViteInput(
  input: ViteInputs,
  file: string,
): Promise<void> {
  const bytes = await fs.readFile(file);
  const prior = input.files.get(file);
  if (prior && !Buffer.from(prior).equals(bytes))
    throw new Error(
      `${input.paths.name(file)} changed during Vite compilation`,
    );
  input.files.set(file, bytes);
}

/** Reject changed loader inputs before a recipe can report stale physical digests. */
export async function verifyViteInputs(input: ViteInputs): Promise<void> {
  for (const [file, bytes] of input.files) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    if ((await fileDigest(file)) !== digest)
      throw new Error(
        `${input.paths.name(file)} changed during Vite compilation`,
      );
  }
}
