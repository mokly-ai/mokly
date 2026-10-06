import fs from "node:fs/promises";
import path from "node:path";

import { extractCssReferences } from "../../dist/css_references.js";
import { extractHtmlReferences } from "../../dist/html_references.js";
import { classifyResourceUrl } from "../../dist/resource_url.js";

/** The outcome of one audit of generated resource references. */
export interface ResourceReferenceAudit {
  failures: string[];
  htmlFiles: number;
  localReferences: number;
}

type FileCheck = (target: string) => Promise<boolean>;

/**
 * Why one local reference fails, using the build's link validation rules:
 * strip the fragment and then the query, percent-decode, and resolve the path
 * from the referencing file's folder.
 */
async function localProblem(
  root: string,
  file: string,
  value: string,
  isFile: FileCheck,
): Promise<string | undefined> {
  const [withoutFragment] = value.split("#", 2);
  const rawPath = (withoutFragment ?? "").split("?", 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return "invalid URL encoding";
  }
  if (decoded.startsWith("/") || decoded.startsWith("\\"))
    return "root-absolute";
  const target = path.resolve(path.dirname(file), decoded);
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return "outside the generated root";
  return (await isFile(target)) ? undefined : "missing file";
}

/**
 * Check every resource reference in the generated HTML and CSS files under
 * `root`. Extraction and classification are the build's own:
 * `extractHtmlReferences`, `extractCssReferences` and `classifyResourceUrl`.
 */
export async function auditGeneratedResourceReferences(
  root: string,
): Promise<ResourceReferenceAudit> {
  const files = (await fs.readdir(root, { recursive: true }))
    .filter((file) => file.endsWith(".html") || file.endsWith(".css"))
    .sort();
  const known = new Map<string, Promise<boolean>>();
  const isFile: FileCheck = (target) => {
    let result = known.get(target);
    if (!result) {
      result = fs.stat(target).then(
        (stats) => stats.isFile(),
        () => false,
      );
      known.set(target, result);
    }
    return result;
  };
  const audit: ResourceReferenceAudit = {
    failures: [],
    htmlFiles: 0,
    localReferences: 0,
  };
  for (const file of files) {
    const absolute = path.join(root, file);
    const content = await fs.readFile(absolute, "utf8");
    const source = file.endsWith(".css") ? "css" : "html";
    if (source === "html") audit.htmlFiles += 1;
    const values =
      source === "css"
        ? extractCssReferences(content)
        : extractHtmlReferences(content).resources;
    for (const value of values) {
      const classification = classifyResourceUrl(value, source);
      if (classification.kind === "external") continue;
      let reason: string | undefined;
      if (classification.kind === "invalid") reason = classification.reason;
      else if (!value.startsWith("#") && !value.startsWith("?")) {
        audit.localReferences += 1;
        reason = await localProblem(root, absolute, value, isFile);
      }
      if (reason)
        audit.failures.push(
          `${file.split(path.sep).join("/")}: ${value} (${reason})`,
        );
    }
  }
  audit.failures.sort();
  return audit;
}
