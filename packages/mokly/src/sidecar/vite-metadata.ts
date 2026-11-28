import fs from "node:fs/promises";

import { metadataDigest } from "./file-digests.js";
import { resolutionInputs } from "./resolution-inputs.js";
import { recordPreviewInputs } from "./storybook-folders.js";
import type { PreviewProbe } from "./storybook-folders.js";
import { recordStorybookInputs } from "./storybook-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";
import type { SetupSnapshot } from "./vite-setup-snapshot.js";

/** Keep live reuse and core watch inputs alongside the Vite recipe. */
export async function viteMetadata(
  input: ViteInputs,
  setup: SetupSnapshot,
  graphFiles: ReadonlySet<string>,
  storybookInputs?: ReadonlyMap<string, string | null>,
  previewProbe?: PreviewProbe,
) {
  const { params, paths, peers } = input;
  const inputs: Record<string, string | null> = {};
  const metadataInputs: Record<string, string | null> = {};
  const record = async (file: string, bytes?: Uint8Array) => {
    metadataInputs[paths.metadataName(file)] = inputs[file] =
      await metadataDigest(file, inputs, bytes);
  };
  for (const [file, bytes] of input.files) {
    inputs[file] = await metadataDigest(file, inputs, bytes);
    if (!graphFiles.has(file))
      metadataInputs[paths.metadataName(file)] = inputs[file];
  }
  if (previewProbe)
    await recordPreviewInputs(
      params.sourceRoot,
      previewProbe,
      inputs,
      metadataInputs,
    );
  recordStorybookInputs(paths, storybookInputs, inputs, metadataInputs);
  for (const name of ["react/package.json", "react-dom/package.json"]) {
    const file = peers[name];
    if (typeof file === "string") await record(file, await fs.readFile(file));
  }
  const directories = await resolutionInputs(
    paths,
    [
      ...input.files.keys(),
      ...[...setup.configuration.values()].flatMap(({ file }) =>
        file ? [file] : [],
      ),
    ],
    inputs,
    metadataInputs,
  );
  for (const [file, digest] of input.pluginInputs)
    metadataInputs[paths.metadataName(file)] = inputs[file] = digest;
  for (const { name, file, digest } of setup.inputs) {
    metadataInputs[name] = digest;
    if (file) inputs[file] = digest;
  }
  return { inputs, metadataInputs, ...directories };
}
