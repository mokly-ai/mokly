import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";
import { entriesUnder } from "../helpers/catalogue_selection.js";
import { repositoryRoot } from "../helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV8;

export const componentDesignRoutes = entriesUnder(
  manifest,
  "design/components",
  { kind: "screen" },
).map((entry) => entry.path);

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
