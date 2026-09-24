import path from "node:path";

import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";
import {
  extractCssReferences,
  extractHtmlReferences,
  resolveLocalReferencePath,
  type HtmlReferenceOptions,
} from "../html_references.js";

/** Resolve portable local resource references using the snapshot URL rules. */
export function referencedRoutes(
  sourceRoute: string,
  content: ReviewArtifactContent,
  options?: HtmlReferenceOptions,
  generated?: { readonly prefix: string; readonly routes: ReadonlySet<string> },
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
        const source = generated?.routes.has(sourceRoute)
          ? path.posix.join(generated.prefix, sourceRoute)
          : sourceRoute;
        const resolved = resolveReference(source, reference);
        if (
          resolved &&
          generated &&
          resolved.startsWith(`${generated.prefix}/`)
        ) {
          const route = resolved.slice(generated.prefix.length + 1);
          if (!generated.routes.has(route))
            throw assetError(
              sourceRoute,
              `referenced generated document is missing: ${reference}`,
            );
          return [route];
        }
        return resolved ? [resolved] : [];
      }),
    ),
  ].sort();
}

export function resolveReference(
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
  const resolved = resolveLocalReferencePath(sourceRoute, reference);
  if (resolved.kind === "invalid-encoding")
    throw assetError(sourceRoute, `invalid asset URL ${reference}`);
  if (resolved.kind === "root-absolute")
    throw assetError(
      sourceRoute,
      `non-portable asset URL ${reference} (root-absolute)`,
    );
  if (resolved.kind !== "resolved") {
    throw assetError(sourceRoute, `asset URL escapes mockupsDir: ${reference}`);
  }
  return resolved.path;
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
