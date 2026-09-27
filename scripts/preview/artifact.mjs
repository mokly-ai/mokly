import fs from "node:fs";
import path from "node:path";

import {
  parseStaticDelivery,
  parseViewHref,
  viewHref,
} from "@mokly/viewer/data";

import { ownedEntries } from "../../dist/export/ownership.js";
import { isExportPublicName } from "../../dist/export/resource_policy.js";
import {
  markCapturedShell,
  STAGED_DEPLOYMENT_ID,
} from "../../dist/export/shell_metadata.js";
import { stageExport } from "../../dist/export/stage.js";
import { advertisePublicationShell } from "../../dist/publication/shell_previews.js";

import { comparisonMetadata } from "./comparisons.mjs";

/** Only this repository adapter can adopt the previous preview marker. */
const previewMarker = {
  marker: ".mokly-preview-artifact",
  contents: "schemaVersion=1\n",
};

/** Validate legacy preview names using the active config and historical path policy. */
export const previewOwnership = (config) => ({
  ...previewMarker,
  accepts: (name) =>
    ["index.html", "404.html", "_headers", "_redirects"].includes(name) ||
    // Legacy markers may own pre-derived view paths at this migration boundary.
    (name.startsWith("view/") && name.endsWith(".html")) ||
    (name.startsWith("static/") &&
      isExportPublicName(name.slice(7), config, {
        allowBuildDirectories: true,
        resolveAliases: false,
      })) ||
    /^__mokly\/(?:shell\.css|client\/[^/]+\.js|navigation\/[^/]+\.js|fonts\/[^/]+|diffs\/__generations\/[A-Za-z0-9-]+\/.+)$/.test(
      name,
    ),
});

/** Share the exporter's alias checks, ownership inventory, and deployment identity. */
export async function stagePreviewArtifact(
  stage,
  manifest,
  removed,
  comparison,
  removedPreviews,
) {
  const files = new Map();
  for (const name of (await ownedEntries(stage)).files)
    files.set(name, await fs.promises.readFile(path.join(stage, name)));
  const currentIds = new Set(manifest.entries.map((entry) => entry.id));
  const entries = [
    ...manifest.entries,
    ...removed.filter((entry) => !currentIds.has(entry.id)),
  ];
  const delivery = parseStaticDelivery({
    schemaVersion: 3,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${comparison.directory}/review.json` : null,
  });
  if (!delivery) throw new Error("Invalid preview delivery metadata");
  const shells = new Map();
  const addShell = (name, canonicalPath, source = name) => {
    const bytes = files.get(source);
    if (bytes === undefined)
      throw new Error(`Missing captured preview shell: ${source}`);
    const descriptor = { ...delivery, canonicalPath };
    const captured = Buffer.from(bytes).toString("utf8");
    files.set(
      name,
      markCapturedShell(
        name,
        advertisePublicationShell(
          name,
          captured,
          canonicalPath,
          removed,
          removedPreviews,
        ),
        descriptor,
      ),
    );
    shells.set(name, descriptor);
  };
  addShell("index.html", "/");
  addShell("404.html", "/404.html");
  for (const entry of entries) {
    const canonicalPath = viewHref(entry.kind, entry.id);
    addShell(canonicalPath.slice(1), canonicalPath);
  }
  const aliases = new Map();
  for (const [name, bytes] of files) {
    const pathname = `/${name}`;
    const identity = parseViewHref(pathname);
    const canonicalView =
      identity !== undefined &&
      viewHref(identity.kind, identity.id) === pathname;
    if (canonicalView || /^static\/.+\.html$/.test(name))
      aliases.set(name.slice(0, -5), name);
    if (name.endsWith(".html") && !name.startsWith("__mokly/diffs/"))
      files.set(
        name,
        Buffer.from(bytes)
          .toString("utf8")
          .replace(
            /(href|src|data-fragment-light|data-fragment-dark)="\/(static|view)\/([^"]+)\.html"/g,
            '$1="/$2/$3"',
          ),
      );
  }
  const metadata = comparison
    ? comparisonMetadata(delivery.comparisonUrl)
    : undefined;
  files.set("_redirects", metadata ? `${metadata.redirect}\n` : "\n");
  if (metadata) files.set("_headers", metadata.headers);
  files.set(previewMarker.marker, previewMarker.contents);
  await stageExport(stage, files, shells, aliases);
}
