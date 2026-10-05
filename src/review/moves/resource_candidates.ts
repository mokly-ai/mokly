import type { ManifestEntry } from "@mokly/viewer/data";

import { isValidGeneratedRoute } from "../../build/styles/routes.js";
import { isMoklyError } from "../../errors.js";
import { referencedRoutes } from "../asset_references.js";
import type { ReviewAssetReader } from "../assets.js";

import { moveDocuments } from "./content.js";
import { moveIdentity } from "./types.js";

/** Select moves and paired entries whose rendered generated-resource routes differ. */
export async function moveResourceCandidates(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  beforeReader: ReviewAssetReader,
  afterReader: ReviewAssetReader,
  changedDocuments?: ReadonlySet<string>,
): Promise<{
  before: readonly ManifestEntry[];
  after: readonly ManifestEntry[];
  beforeViews: ReadonlySet<string>;
  afterViews: ReadonlySet<string>;
}> {
  const bases = new Map(before.map((entry) => [moveIdentity(entry), entry]));
  const heads = new Map(after.map((entry) => [moveIdentity(entry), entry]));
  const baseCandidates = new Set(
    before.filter(
      (entry) =>
        heads.get(moveIdentity(entry))?.sourcePath !== entry.sourcePath,
    ),
  );
  const headCandidates = new Set(
    after.filter(
      (entry) =>
        bases.get(moveIdentity(entry))?.sourcePath !== entry.sourcePath,
    ),
  );
  const beforeViews = new Set(
    [...baseCandidates].flatMap((entry) =>
      moveDocuments(entry).map((view) => view.route),
    ),
  );
  const afterViews = new Set(
    [...headCandidates].flatMap((entry) =>
      moveDocuments(entry).map((view) => view.route),
    ),
  );
  for (const head of after) {
    const base = bases.get(moveIdentity(head));
    if (
      !base ||
      headCandidates.has(head) ||
      (head.kind !== "screen" && head.kind !== "component")
    )
      continue;
    const baseViews = new Map(
      moveDocuments(base).map((view) => [view.key, view]),
    );
    for (const view of moveDocuments(head)) {
      const other = baseViews.get(view.key);
      if (!other) continue;
      if (
        changedDocuments &&
        other.route === view.route &&
        !changedDocuments.has(view.route)
      )
        continue;
      const [left, right] = await Promise.all([
        beforeReader.read(other.route),
        afterReader.read(view.route),
      ]);
      if (other.route === view.route && Buffer.compare(left, right) === 0)
        continue;
      const previous = generatedReferences(other.route, left);
      const current = generatedReferences(view.route, right);
      if (!previous || !current) continue;
      if (
        previous.size === current.size &&
        [...previous].every((route) => current.has(route))
      )
        continue;
      baseCandidates.add(base);
      headCandidates.add(head);
      beforeViews.add(other.route);
      afterViews.add(view.route);
    }
  }
  return {
    before: [...baseCandidates],
    after: [...headCandidates],
    beforeViews,
    afterViews,
  };
}

function generatedReferences(
  route: string,
  html: Uint8Array,
): ReadonlySet<string> | undefined {
  try {
    return new Set(
      referencedRoutes(route, html, { resourceHints: false }).filter(
        isValidGeneratedRoute,
      ),
    );
  } catch (error) {
    if (isMoklyError(error) && error.code === "review-invalid") return;
    throw error;
  }
}
