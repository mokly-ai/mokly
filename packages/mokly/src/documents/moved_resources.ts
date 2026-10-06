import path from "node:path";

import { referencedRoutes } from "../review/asset_references.js";
import type { ReviewAssetReader } from "../review/assets.js";

import {
  linkedDocumentResources,
  type DocumentResourceIndex,
} from "./resource_references.js";

/** Prove equal copied bytes at corresponding relative references of one moved document. */
export async function equivalentDocumentResources(
  source: string,
  html: string,
  before: { path: string; html: string } | undefined,
  index: { before: DocumentResourceIndex; after: DocumentResourceIndex },
  baseline: ReviewAssetReader,
  current: ReviewAssetReader,
): Promise<ReadonlySet<string>> {
  const equal = new Set<string>();
  if (
    !before ||
    before.path === source ||
    !index.before.has(before.path) ||
    !index.after.has(source)
  )
    return equal;
  const referenced = (
    route: string,
    content: string,
    side: DocumentResourceIndex,
  ) => {
    const declared = side.get(route)!;
    return [
      ...new Set([
        ...referencedRoutes(route, content, { resourceHints: false }),
        ...linkedDocumentResources(route, content, side),
      ]),
    ].filter((resource) => declared.has(resource));
  };
  const bases = new Map(
    referenced(before.path, before.html, index.before).map((route) => [
      path.posix.relative(path.posix.dirname(before.path), route),
      route,
    ]),
  );
  for (const route of referenced(source, html, index.after)) {
    const previous = bases.get(
      path.posix.relative(path.posix.dirname(source), route),
    );
    if (!previous || previous === route) continue;
    const [left, right] = await Promise.all([
      baseline.read(previous),
      current.read(route),
    ]);
    if (Buffer.from(left).equals(Buffer.from(right))) {
      equal.add(previous);
      equal.add(route);
    }
  }
  return equal;
}
