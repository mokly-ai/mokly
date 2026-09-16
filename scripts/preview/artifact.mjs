import fs from "node:fs";
import path from "node:path";

import { ownedEntries } from "../../dist/export/ownership.js";
import { isExportPublicName } from "../../dist/export/resource_policy.js";
import {
  markCapturedShell,
  STAGED_DEPLOYMENT_ID,
} from "../../dist/export/shell_metadata.js";
import { stageExport } from "../../dist/export/stage.js";
import {
  catalogueViewHref,
  parseStaticDelivery,
} from "../../dist/navigation/delivery.js";

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
) {
  const files = new Map();
  for (const name of (await ownedEntries(stage)).files)
    files.set(name, await fs.promises.readFile(path.join(stage, name)));
  const idRoutes = Object.create(null);
  const currentIds = new Set(manifest.entries.map((entry) => entry.id));
  const entries = [
    ...manifest.entries,
    ...removed.filter((entry) => !currentIds.has(entry.id)),
  ];
  for (const entry of entries)
    if (entry.kind !== "collection")
      idRoutes[entry.id] = catalogueViewHref(entry.route);
  const delivery = parseStaticDelivery({
    schemaVersion: 2,
    deploymentId: STAGED_DEPLOYMENT_ID,
    canonicalPath: "/",
    comparisonUrl: comparison ? `/${comparison.directory}/review.json` : null,
    idRoutes,
  });
  if (!delivery) throw new Error("Invalid preview delivery metadata");
  const shells = new Map();
  const addShell = (name, canonicalPath, source = name) => {
    const bytes = files.get(source);
    if (bytes === undefined)
      throw new Error(`Missing captured preview shell: ${source}`);
    const descriptor = { ...delivery, canonicalPath };
    files.set(
      name,
      markCapturedShell(name, Buffer.from(bytes).toString("utf8"), descriptor),
    );
    shells.set(name, descriptor);
  };
  for (const [id, route] of Object.entries(idRoutes))
    addShell(`id/${id}/index.html`, route, decodeURIComponent(route.slice(1)));
  addShell("index.html", "/");
  addShell("404.html", "/404.html");
  for (const entry of [...manifest.entries, ...removed])
    if (entry.kind !== "collection")
      addShell(`view/${entry.route}`, catalogueViewHref(entry.route));
  const aliases = new Map();
  for (const [name, bytes] of files) {
    if (/^(?:view|static)\/.+\.html$/.test(name))
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
  const redirects = Object.entries(idRoutes).map(
    ([id, route]) => `/id/${id} ${route.replace(/\.html$/, "")} 302`,
  );
  files.set(
    "_redirects",
    `${[...(metadata ? [metadata.redirect] : []), ...redirects].join("\n")}\n`,
  );
  if (metadata) files.set("_headers", metadata.headers);
  files.set(previewMarker.marker, previewMarker.contents);
  await stageExport(stage, files, shells, aliases);
}
