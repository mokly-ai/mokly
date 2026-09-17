import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import {
  fragmentViolation,
  htmlResource,
  type ResourceReference,
} from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../html_references.js";

import { exportError } from "./error.js";
import { ExportPathIndex } from "./path_index.js";

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
              htmlResource(
                extractHtmlReferences(Buffer.from(bytes).toString("utf8")),
              ),
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
          (item) => !item.checkFragment || !name.includes("/snapshots/"),
        ),
      );
    } else if (extension === ".css")
      references.push(
        ...extractCssReferences(content).map((value) => ({
          value,
          checkFragment: false,
        })),
      );
    else if (extension === ".js" && name.startsWith("__mokly/")) {
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
  if (reference === "" || /^(?:https?:|mailto:|tel:|data:)/i.test(reference))
    return undefined;
  if (reference.startsWith("#") || reference.startsWith("?")) return source;
  if (reference.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(reference))
    throw exportError(`Unsupported export URL: ${source} -> ${reference}`);
  const encoded = reference.split(/[?#]/, 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch (error) {
    throw exportError(`Invalid export URL: ${reference}`, error);
  }
  if (decoded === "/") return "index.html";
  const resolved = path.posix.normalize(
    decoded.startsWith("/")
      ? decoded.slice(1)
      : path.posix.join(path.posix.dirname(source), decoded),
  );
  const target = resolved.replace(/\/$/, "");
  if (!isSafeRepositoryPath(target))
    throw exportError(`Export URL escapes the site: ${reference}`);
  return target;
}
