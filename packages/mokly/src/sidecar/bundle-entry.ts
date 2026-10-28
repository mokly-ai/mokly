import fs from "node:fs/promises";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { logical } from "./path-scope.js";
import { confinedFile } from "./paths.js";

/** Storybook preview candidates, also absent ones, which the recipe hashes. */
export const previewCandidates = ["tsx", "ts", "jsx", "js", "mjs", "cjs"].map(
  (extension) => `.storybook/preview.${extension}`,
);

/**
 * The virtual entry module: it imports every entry, story, and renderer file
 * and exports them by logical path. `inputPaths` maps each logical path to its
 * confined real file.
 */
export async function entryModule(params: BundleParams) {
  const files = [
    ...params.entryFiles,
    ...params.storiesFiles,
    ...(params.renderer ? [params.renderer] : []),
  ];
  const inputPaths = new Map<string, string>();
  for (const file of files)
    inputPaths.set(
      logical(params.sourceRoot, path.resolve(params.sourceRoot, file)),
      await confinedFile(params.sourceRoot, file),
    );
  const preview = params.storiesFiles.length
    ? (
        await Promise.all(
          previewCandidates.map(
            async (file) =>
              await fs.access(path.resolve(params.sourceRoot, file)).then(
                () => file,
                () => null,
              ),
          ),
        )
      ).find(Boolean)
    : null;
  const imports = files.map(
    (file, index) =>
      `import * as m${index} from ${JSON.stringify(path.resolve(params.sourceRoot, file))};`,
  );
  if (preview)
    imports.push(
      `import * as preview from ${JSON.stringify(path.resolve(params.sourceRoot, preview))}; export { preview };`,
    );
  imports.push(
    `export const entries = {${params.entryFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index}`).join(",")}};`,
  );
  imports.push(
    `export const stories = {${params.storiesFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index + params.entryFiles.length}`).join(",")}};`,
  );
  if (params.renderer)
    imports.push(`export const renderer = m${files.length - 1};`);
  return { contents: imports.join("\n"), inputPaths, preview };
}
