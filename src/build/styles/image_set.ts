import path from "node:path";

import { toPosixPath } from "../../config/paths.js";
import { MoklyError } from "../../errors.js";
import { extractImageSetStringReferences } from "../../html_references.js";
import { classifyResourceUrl } from "../../resource_url.js";

/** Reject image-set strings before they escape esbuild's asset resolver. */
export function validateImageSetStrings(
  css: string,
  file: string,
  repoRoot: string,
): void {
  const url = extractImageSetStringReferences(css).find(
    (value) => classifyResourceUrl(value, "css").kind !== "external",
  );
  if (url === undefined) return;
  const relative = toPosixPath(path.relative(repoRoot, file));
  throw new MoklyError(
    "build-invalid",
    `image-set() string URL is unsupported in ${relative}: ${url}; wrap the URL in url() so Mokly can validate and deliver the asset`,
  );
}
