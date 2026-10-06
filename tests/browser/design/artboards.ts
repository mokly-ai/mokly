import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { viewRoute } from "../../../packages/viewer/dist/data.js";
import type { ManifestV8 } from "../../../packages/viewer/dist/registry/types.js";
import { repositoryRoot } from "../../helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV8;

/** Current owning component screens, with no served-shell route. */
export const componentDesignRoutes = manifest.entries.flatMap((entry) =>
  entry.kind === "screen" && entry.path.startsWith("design/components/")
    ? [entry.path]
    : [],
);

/** Open a real generated design view directly from disk. */
export function designArtboardUrl(
  entryPath: string,
  viewport: "mobile" | "desktop",
  scheme: "light" | "dark" = "light",
): string {
  const entry = manifest.entries.find((entry) => entry.path === entryPath);
  if (
    !entryPath.startsWith("design/") ||
    !entry ||
    !(
      entry.kind === "screen" ||
      (entry.kind === "component" && "variantOf" in entry)
    )
  )
    throw new Error(`Unknown design artboard: ${entryPath}`);
  if (!entry.colorSchemes.includes(scheme))
    throw new Error(`Missing ${scheme} design artboard: ${entryPath}`);
  const file = path.join(generated, viewRoute(entry.path, viewport, scheme));
  fs.accessSync(file);
  return pathToFileURL(file).href;
}
