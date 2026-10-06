import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { extractCssReferences } from "../css_references.js";
import { documentWorkSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  extractHtmlReferences,
  type HtmlReferenceOptions,
} from "../html_references.js";
import { classifyResourceUrl } from "../resource_url.js";

/** Resolve portable local resource references using the snapshot URL rules. */
export function referencedRoutes(
  sourceRoute: string,
  content: ReviewArtifactContent,
  options?: HtmlReferenceOptions,
): string[] {
  return documentWorkSync("referenceMs", () => {
    const extension = path.posix.extname(sourceRoute).toLowerCase();
    const text =
      typeof content === "string"
        ? content
        : Buffer.from(content).toString("utf8");
    const html =
      extension === ".html" || extension === ".htm"
        ? extractHtmlReferences(text, options)
        : undefined;
    const references =
      extension === ".css"
        ? extractCssReferences(text)
        : (html?.resources ?? []);
    return referenceRoutes(sourceRoute, references);
  });
}

export function referenceRoutes(
  sourceRoute: string,
  references: readonly string[],
): string[] {
  return documentWorkSync("referenceMs", () => {
    return [
      ...new Set(
        references.flatMap((reference) => {
          const resolved = resolveResourceReference(sourceRoute, reference);
          return resolved ? [resolved] : [];
        }),
      ),
    ].sort();
  });
}

/** Resolve one reference with the same confinement used by resource traversal. */
export function resolveResourceReference(
  sourceRoute: string,
  rawReference: string,
): string | undefined {
  const reference = rawReference.trim();
  const classification = classifyResourceUrl(
    reference,
    sourceRoute.endsWith(".css") ? "css" : "html",
  );
  if (classification.kind === "external" || reference.startsWith("#")) return;
  if (classification.kind === "invalid") {
    throw assetError(
      sourceRoute,
      `non-portable asset URL ${reference} (${classification.reason})`,
    );
  }
  const encodedPath = reference.split(/[?#]/, 1)[0] ?? "";
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch (error) {
    throw assetError(sourceRoute, `invalid asset URL ${reference}`, error);
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourceRoute), decodedPath),
  );
  if (!isSafeRepositoryPath(resolved)) {
    throw assetError(sourceRoute, `asset URL escapes mockupsDir: ${reference}`);
  }
  return resolved;
}

function assetError(
  route: string,
  detail: string,
  cause?: unknown,
): MoklyError {
  return new MoklyError(
    "review-invalid",
    `could not retain Review asset ${route}: ${detail}`,
    cause === undefined ? undefined : { cause },
  );
}
