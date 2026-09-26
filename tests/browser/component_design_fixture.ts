import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ManifestV7 } from "../../packages/viewer/dist/registry/types.js";
import { repositoryRoot } from "../helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV7;

export const componentDesignRoutes = manifest.entries.flatMap((entry) =>
  entry.kind === "screen" && entry.id.startsWith("design-component-")
    ? [entry.id]
    : [],
);

const legacyIds: Readonly<Record<string, string>> = {
  overview: "design-component-overview",
  "pages/help": "design-component-help",
  "pages/variants": "design-component-variants",
  "pages/comparison": "design-component-comparison",
  "pages/affected": "design-component-affected",
  "pages/toolbar": "design-component-toolbar",
  "controls/overview": "design-component-controls",
  "controls/editing/edited": "design-component-controls-edited",
  "controls/editing/unset": "design-component-controls-unset",
  "controls/editing/variant": "design-component-controls-variant",
  "controls/editing/reset": "design-component-controls-reset",
  "controls/states/pending": "design-component-controls-pending",
  "controls/states/invalid": "design-component-controls-invalid",
  "controls/states/error": "design-component-controls-error",
  "controls/states/comparison": "design-component-controls-comparison",
  "controls/published/default": "design-component-controls-readonly",
  "controls/published/variant": "design-component-controls-readonly-variant",
  "inspection/details": "design-component-inspection-details",
  "inspection/highlight": "design-component-inspection-highlight",
  "inspection/nested": "design-component-inspection-nested",
  "inspection/direct-change": "design-component-inspection-direct-change",
  "inspection/consumer": "design-component-inspection-consumer",
  "inspection/selection/toolbar": "design-component-inspection-toolbar",
  "inspection/selection/help": "design-component-inspection-help",
  "inspector/component": "design-component-inspector-closed",
  "inspector/screen": "design-component-screen-inspector-closed",
  "states/empty": "design-component-empty",
  "states/unavailable": "design-component-unavailable",
  "states/unused": "design-component-unused",
  "states/removed": "design-component-removed",
  "states/removed-consumer": "design-component-removed-consumer",
  "states/additions/added": "design-component-added",
  "states/shared-impact/action": "design-component-shared-impact",
};

export function componentDesignUrl(route: string, viewport: string): string {
  const id = route.startsWith("design-component-") ? route : legacyIds[route];
  if (!id) throw new Error(`Unknown component design route: ${route}`);
  return pathToFileURL(
    path.join(
      repositoryRoot,
      "examples/basic/generated/screens",
      `${id}.${viewport}.html`,
    ),
  ).href;
}
