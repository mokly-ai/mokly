import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { logical } from "./path-scope.js";
import { confinedFile } from "./paths.js";
import { previewModules, probePreviews } from "./storybook-folders.js";
import type { PreviewProbe } from "./storybook-folders.js";

export const virtualEntry = "mokly-entry";

/**
 * The virtual entry module: it imports every entry, story, and renderer file
 * and exports them by logical path. `inputPaths` maps each logical path to its
 * confined real file. Captured previews supply the selection. Missing
 * evidence uses the file probes.
 */
export async function entryModule(
  params: BundleParams,
  capturedPreviews?: PreviewProbe,
) {
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
  const previewProbe = capturedPreviews ?? (await probePreviews(params));
  const previews = new Map(previewModules(previewProbe.selections));
  const imports = files.map(
    (file, index) =>
      `import * as m${index} from ${JSON.stringify(path.resolve(params.sourceRoot, file))};`,
  );
  if (previews.size) {
    const bindings: string[] = [];
    for (const [folder, file] of previews) {
      const name = `p${bindings.length}`;
      const specifier = JSON.stringify(path.resolve(params.sourceRoot, file));
      imports.push(
        params.vite
          ? `import * as ${name} from ${specifier};`
          : `const ${name} = require(${specifier});`,
      );
      bindings.push(`[${JSON.stringify(folder)}]:${name}`);
    }
    imports.push(`export const previews = {${bindings.join(",")}};`);
  }
  imports.push(
    `export const entries = {${params.entryFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index}`).join(",")}};`,
  );
  imports.push(
    `export const stories = {${params.storiesFiles.map((file, index) => `${JSON.stringify(logical(params.sourceRoot, path.resolve(params.sourceRoot, file)))}:m${index + params.entryFiles.length}`).join(",")}};`,
  );
  if (params.renderer)
    imports.push(`export const renderer = m${files.length - 1};`);
  return { contents: imports.join("\n"), inputPaths, previews, previewProbe };
}
