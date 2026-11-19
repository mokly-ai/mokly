import fs from "node:fs/promises";
import path from "node:path";

import { previewCandidates } from "./bundle-entry.js";
import { metadataDigest } from "./file-digests.js";
import { resolutionInputs } from "./resolution-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";

/** Keep live reuse and core watch inputs alongside the Vite recipe. */
export async function viteMetadata(input: ViteInputs, setupFiles: string[]) {
  const { params, paths, require } = input;
  const inputs: Record<string, string | null> = {};
  const metadataInputs: Record<string, string | null> = {};
  const record = async (file: string, bytes?: Uint8Array) => {
    metadataInputs[paths.metadataName(file)] = inputs[file] =
      await metadataDigest(file, inputs, bytes);
  };
  for (const [file, bytes] of input.files) await record(file, bytes);
  for (const file of setupFiles) await record(await paths.metadata(file));
  for (const file of params.storiesFiles.length ? previewCandidates : [])
    await record(path.resolve(params.sourceRoot, file));
  for (const root of paths.dependencyRoots)
    await record(path.join(root, "react/package.json"));
  try {
    const file = require.resolve("react/package.json");
    await record(file, await fs.readFile(file));
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND"
    ))
      throw error;
  }
  const directories = await resolutionInputs(
    paths,
    [...input.files.keys(), ...setupFiles],
    inputs,
    metadataInputs,
  );
  return { inputs, metadataInputs, ...directories };
}
