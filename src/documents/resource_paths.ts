import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

/** Only portable media and PDF files can be copied from a document root. */
export function isDocumentResource(file: string): boolean {
  return /\.(?:png|jpe?g|gif|svg|webp|avif|pdf)$/i.test(file);
}

/** Index detection uses the complete basename, independently of first-dot leaves. */
export function isIndexDocument(file: string): boolean {
  return /^(?:readme|index)\.md$/i.test(path.posix.basename(file));
}

/** Reconstruct a resource's output route from persisted document metadata. */
export function documentResourceRoute(
  entry: { path: string; sourcePath: string },
  resource: string,
): string | undefined {
  if (!isSafeRepositoryPath(resource) || !isDocumentResource(resource)) return;
  const folder = isIndexDocument(entry.sourcePath)
    ? entry.path
    : path.posix.dirname(entry.path);
  const relative = path.posix.relative(
    path.posix.dirname(entry.sourcePath),
    resource,
  );
  const route = path.posix.normalize(path.posix.join(folder, relative));
  return isSafeRepositoryPath(route) &&
    route.split("/")[0]!.toLowerCase() !== "mokly-generated"
    ? route
    : undefined;
}
