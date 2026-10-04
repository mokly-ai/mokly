import path from "node:path";

import {
  VIEWER_DIRECTORY,
  isSafeRepositoryPath,
  snapshotSidePath,
} from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import {
  fragmentViolation,
  htmlResource,
  type ResourceReference,
} from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
  resolveLocalReferencePath,
} from "../html_references.js";
import { classifyResourceUrl } from "../resource_url.js";

import { exportError } from "./error.js";
import { ExportPathIndex } from "./path_index.js";

const SNAPSHOT_MARKER = `/${path.posix.dirname(snapshotSidePath("before"))}/`;

/** Prove every local document/resource/module request has an exported target. */
export function validateExportReferences(
  files: ReadonlyMap<string, ReviewArtifactContent>,
  aliases: ReadonlyMap<string, string> = new Map(),
): void {
  const paths = new ExportPathIndex();
  for (const name of files.keys()) paths.add(name);
  for (const [alias, target] of aliases) {
    if (
      !isSafeRepositoryPath(alias) ||
      !isSafeRepositoryPath(target) ||
      !files.has(target)
    )
      throw exportError(`Invalid hosting alias: ${alias} -> ${target}`);
    paths.add(alias);
  }
  const documents = new Map(
    [...files].flatMap(([name, bytes]) =>
      /\.html?$/i.test(name)
        ? [
            [
              name,
              (() => {
                const extracted = extractHtmlReferences(
                  Buffer.from(bytes).toString("utf8"),
                );
                return htmlResource(extracted);
              })(),
            ] as const,
          ]
        : [],
    ),
  );
  for (const [name, bytes] of files) {
    const content = Buffer.from(bytes).toString("utf8");
    const extension = path.posix.extname(name).toLowerCase();
    const references: ResourceReference[] = [];
    if (extension === ".html" || extension === ".htm") {
      references.push(
        ...(documents.get(name)?.references ?? []).filter(
          (item) => !item.checkFragment || !name.includes(SNAPSHOT_MARKER),
        ),
      );
    } else if (extension === ".css")
      references.push(
        ...extractCssReferences(content).map((value) => ({
          value,
          checkFragment: false,
        })),
      );
    else if (extension === ".js" && name.startsWith(`${VIEWER_DIRECTORY}/`)) {
      for (const match of content.matchAll(
        /\b(?:from|import)\s*["']([^"']+)["']/g,
      ))
        references.push({ value: match[1] ?? "", checkFragment: false });
    }
    for (const reference of references) {
      const target = referenceTarget(name, reference.value);
      if (target === undefined) continue;
      const resolved = files.has(target)
        ? target
        : (aliases.get(target) ?? `${target}/index.html`);
      if (!files.has(resolved))
        throw exportError(
          `Export resource is unavailable: ${name} -> ${reference.value}`,
        );
      const violation = reference.checkFragment
        ? fragmentViolation(
            reference.value,
            documents.get(resolved)?.anchors ?? new Set(),
          )
        : undefined;
      if (violation)
        throw exportError(`Export link is invalid: ${name} -> ${violation}`);
    }
  }
}

function referenceTarget(source: string, value: string): string | undefined {
  const reference = value.trim();
  const classification = classifyResourceUrl(
    reference,
    source.endsWith(".css") ? "css" : "html",
  );
  if (classification.kind === "external") return;
  if (reference.startsWith("#") || reference.startsWith("?")) return source;
  if (
    classification.kind === "invalid" &&
    classification.reason !== "root-absolute"
  )
    throw exportError(`Unsupported export URL: ${source} -> ${reference}`);
  const resolved = resolveLocalReferencePath(source, reference, true);
  if (resolved.kind === "invalid-encoding")
    throw exportError(`Invalid export URL: ${reference}`);
  if (resolved.kind !== "resolved")
    throw exportError(`Export URL escapes the site: ${reference}`);
  return resolved.path;
}
