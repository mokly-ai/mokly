import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { write } from "./static_changes.js";

const source = (metadata: Record<string, unknown>, body: string) =>
  `---\n${JSON.stringify(metadata)}\n---\n${body}`;
const schema = (property: string) => ({
  type: "object",
  additionalProperties: false,
  properties: { [property]: { type: "string" } },
});

/** Entries that only the viewer-state Serve journeys add to both commits. */
export const viewerStatePaths = {
  variantParent: "viewer/home",
  quietScreenVariant: "viewer/home/empty",
  changedScreenVariant: "viewer/home/error",
  removedScreenVariant: "viewer/home/gone",
  chip: "viewer/chip",
  plainChip: "viewer/chip/plain",
  nightChip: "viewer/chip/night",
  removedConsumer: "viewer/legacy",
  lightOnlyChanged: "viewer/pale",
  lightOnlyRemoved: "viewer/faded",
} as const;

/**
 * Add the viewer-state shapes under `viewer/`: an unmodified screen with
 * unmodified, changed, and removed variants; an unmodified component whose
 * Night variant changes only in Dark; a removed screen that used Card; and a
 * changed and a removed light-only screen. Specs opt in per file.
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
    await write(
      root,
      "specs/viewer/legacy.screen.html",
      source(
        { title: "Legacy screen" },
        '<h1>Legacy screen</h1><ui-card label="Legacy card"></ui-card>',
      ),
    );
    await write(
      root,
      "specs/viewer/faded.screen.html",
      source(
        { title: "Faded screen", colorSchemes: ["light"] },
        "<h1>Faded screen</h1>",
      ),
    );
  } else {
    for (const file of ["legacy.screen.html", "faded.screen.html"])
      await fs.rm(path.join(root, "specs/viewer", file));
  }
  await write(
    root,
    "night.css",
    `.chip { color: ${before ? "rgb(200, 200, 220)" : "rgb(250, 210, 120)"}; }\n`,
  );
  await write(
    root,
    "specs/viewer/home.screen.html",
    source(
      {
        title: "Home",
        propSchema: schema("state"),
        props: { state: "Ready" },
        variants: [
          {
            slug: "empty",
            title: "Empty workspace",
            props: { state: "Nothing here yet" },
          },
          {
            slug: "error",
            title: "Save failed",
            props: { state: before ? "Could not save" : "Save failed again" },
          },
          ...(before
            ? [
                {
                  slug: "gone",
                  title: "Workspace deleted",
                  props: { state: "Deleted" },
                },
              ]
            : []),
        ],
      },
      "<h1>Home</h1><p>{{state}}</p>",
    ),
  );
  await write(
    root,
    "specs/viewer/chip.component.html",
    source(
      {
        title: "Chip",
        element: "viewer-chip",
        propSchema: schema("label"),
        props: { label: "Chip" },
        variants: [
          { slug: "plain", title: "Plain", props: { label: "Plain chip" } },
          { slug: "night", title: "Night", props: { label: "Night chip" } },
        ],
      },
      '<span class="chip">{{label}}</span>',
    ),
  );
  await write(
    root,
    "specs/viewer/pale.screen.html",
    source(
      { title: "Pale screen", colorSchemes: ["light"] },
      `<main>Pale ${before ? "before" : "after"}</main>`,
    ),
  );
};
