import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

const source = (metadata: Record<string, unknown>, body: string) =>
  `---\n${JSON.stringify(metadata)}\n---\n${body}`;

/** Entries that only the viewer-state Serve journeys add to both commits. */
export const viewerStatePaths = {
  chip: "viewer/chip",
  plainChip: "viewer/chip/plain",
  nightChip: "viewer/chip/night",
} as const;

/**
 * Add an unmodified component under `viewer/` whose Night variant changes
 * only in Dark, through a dark stylesheet that matches that variant alone.
 * Specs opt in per file.
 */
export const addViewerStateSources: ComparisonAdditions = async (
  root,
  side,
) => {
  const before = side === "Before";
  if (before) {
    const config = JSON.parse(
      await fs.readFile(path.join(root, "mokly.config.json"), "utf8"),
    );
    config.stylesheets.unshift({
      match: "viewer/chip/night/index.html",
      stylesheets: ["theme.css"],
      darkStylesheets: ["night.css"],
    });
    await write(root, "mokly.config.json", JSON.stringify(config));
  }
  await write(
    root,
    "night.css",
    `.chip { color: ${before ? "rgb(200, 200, 220)" : "rgb(250, 210, 120)"}; }\n`,
  );
  await write(
    root,
    "specs/viewer/chip.component.html",
    source(
      {
        title: "Chip",
        element: "viewer-chip",
        propSchema: {
          type: "object",
          additionalProperties: false,
          properties: { label: { type: "string" } },
        },
        props: { label: "Chip" },
        variants: [
          { slug: "plain", title: "Plain", props: { label: "Plain chip" } },
          { slug: "night", title: "Night", props: { label: "Night chip" } },
        ],
      },
      '<span class="chip">{{label}}</span>',
    ),
  );
};
