import fs from "node:fs";
import path from "node:path";

import {
  VIEWER_DIRECTORY,
  parseStaticDelivery,
  providerNormalizedHtmlPath,
  viewHref,
} from "@mokly/viewer/data";

import { ownedEntries } from "../../dist/export/ownership.js";
import {
  markCapturedShell,
  STAGED_DEPLOYMENT_ID,
} from "../../dist/export/shell_metadata.js";
import { stageExport } from "../../dist/export/stage.js";
import { advertisePublicationShell } from "../../dist/publication/shell_previews.js";

import { comparisonMetadata } from "./comparisons.mjs";
import { normalizeProviderHtmlAttributes } from "./html_paths.mjs";

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
  const currentPaths = new Set(manifest.entries.map((entry) => entry.path));
  const entries = [
    ...manifest.entries,
    ...removed.filter((entry) => !currentPaths.has(entry.path)),
  ];
  const parsedDelivery = parseStaticDelivery({
    schemaVersion: 5,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${comparison.directory}/review.json` : null,
  });
  if (parsedDelivery.kind !== "valid")
    throw new Error("Invalid preview delivery metadata");
  const delivery = parsedDelivery.value;
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
    const canonicalPath = viewHref(entry.path);
    addShell(`${canonicalPath.slice(1)}index.html`, canonicalPath);
  }
  const aliases = new Map();
  for (const [name, bytes] of files) {
    const pathname = `/${name}`;
    const normalized = providerNormalizedHtmlPath(pathname);
    if (name.startsWith("static/") && normalized && !normalized.endsWith("/"))
      aliases.set(normalized.slice(1), name);
    if (
      name.endsWith(".html") &&
      !name.startsWith(`${VIEWER_DIRECTORY}/diffs/`)
    )
      files.set(
        name,
        normalizeProviderHtmlAttributes(Buffer.from(bytes).toString("utf8")),
      );
  }
  const metadata = comparison
    ? comparisonMetadata(delivery.comparisonUrl)
    : undefined;
  files.set("_redirects", metadata ? `${metadata.redirect}\n` : "\n");
  if (metadata) files.set("_headers", metadata.headers);
  await stageExport(stage, files, shells, aliases);
}
