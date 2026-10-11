import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ManifestV10 } from "../../packages/viewer/dist/registry/types.js";
import { repositoryRoot } from "../helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/mokly-generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV10;

export const componentDesignRoutes = manifest.entries.flatMap((entry) =>
  entry.kind === "screen" && entry.path.startsWith("design/components/")
    ? [entry.path]
    : [],
);

export function componentDesignUrl(
  entryPath: string,
  viewport: string,
): string {
  if (!componentDesignRoutes.includes(entryPath))
    throw new Error(`Unknown component design path: ${entryPath}`);
  return pathToFileURL(
    path.join(generated, entryPath, `index.${viewport}.html`),
  ).href;
}
