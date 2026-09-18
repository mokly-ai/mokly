import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import {
  extractCssReferences,
  extractHtmlReferences,
  type HtmlReferenceOptions,
} from "../html_references.js";

/** Resolve portable local resource references using the snapshot URL rules. */
export function referencedRoutes(
  sourceRoute: string,
  content: ReviewArtifactContent,
  options?: HtmlReferenceOptions,
): string[] {
  const extension = path.posix.extname(sourceRoute).toLowerCase();
  const text =
    typeof content === "string"
      ? content
      : Buffer.from(content).toString("utf8");
  const references =
    extension === ".css"
      ? extractCssReferences(text)
      : extension === ".html" || extension === ".htm"
        ? extractHtmlReferences(text, options).resources
        : [];
  return [
    ...new Set(
      references.flatMap((reference) => {
        const resolved = resolveReference(sourceRoute, reference);
        return resolved ? [resolved] : [];
      }),
    ),
  ].sort();
}

function resolveReference(
  sourceRoute: string,
  rawReference: string,
): string | undefined {
  const reference = rawReference.trim();
  if (reference.startsWith("//")) {
    throw assetError(
      sourceRoute,
      `non-portable asset URL ${reference} (protocol-relative)`,
    );
  }
  if (reference.startsWith("/")) {
    throw assetError(
      sourceRoute,
      `non-portable asset URL ${reference} (root-absolute)`,
    );
  }
  if (
    reference === "" ||
    reference.startsWith("#") ||
    /^(?:https?:|data:)/i.test(reference)
  ) {
    return undefined;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) {
    throw assetError(
      sourceRoute,
      `non-portable asset URL ${reference} (unsupported scheme)`,
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
