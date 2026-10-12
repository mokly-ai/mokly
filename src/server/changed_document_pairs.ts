/** Pair current view documents with their baseline paths and material-change eligibility. */
import path from "node:path";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import type { HistoricalManifest, ManifestV10 } from "@mokly/viewer/data";
import {
  entryRoute,
  documentRoute,
  generatedResourcePath,
  VIEWPORTS,
} from "@mokly/viewer/data";

import { isAuthoringSource } from "../build/source_inventory.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MANIFEST_NAME } from "../registry/manifest.js";
import { baselineEntryIndex } from "../review/moves/entries.js";
import { moveIdentity, type EntryMove } from "../review/moves/types.js";
import { fragmentForView, unionColorSchemes } from "../review/screen_views.js";

export interface DocumentPair {
  base?: string;
  head: string;
  context: string;
  changed: boolean;
  view?: { path: string; viewport: Viewport; colorScheme: ColorScheme };
  pagePath?: string;
}

/** Use accepted byte inventories to select baseline bodies without relying on Git tracking. */
export function markChangedDocumentBytes(
  pairs: readonly DocumentPair[],
  manifest: ManifestV10,
  baseline: HistoricalManifest,
): void {
  const hashes = (value: HistoricalManifest) =>
    new Map(
      value.generatedFiles.map(({ path, blobHash }) => [
        generatedResourcePath(path),
        blobHash,
      ]),
    );
  const before = hashes(baseline),
    after = hashes(manifest);
  for (const pair of pairs)
    pair.changed ||=
      manifest.blobHashAlgorithm !== baseline.blobHashAlgorithm ||
      !pair.base ||
      before.get(pair.base) === undefined ||
      before.get(pair.base) !== after.get(pair.head);
}

export function documentPairs(
  manifest: ManifestV10,
  baseline: HistoricalManifest,
  changed: ReadonlySet<string>,
  documents: "all" | "pages",
  moves: readonly EntryMove[] = [],
): DocumentPair[] {
  const bases = baselineEntryIndex(baseline.entries, moves);
  const pairs: DocumentPair[] = [];
  for (const screen of manifest.entries) {
    const baseEntry = bases.get(moveIdentity(screen));
    if (screen.kind === "document") {
      for (const scheme of screen.colorSchemes) {
        const base =
          baseEntry?.kind === "document" &&
          baseEntry.colorSchemes.includes(scheme)
            ? generatedResourcePath(documentRoute(baseEntry.path, scheme))
            : undefined;
        const head = generatedResourcePath(documentRoute(screen.path, scheme));
        pairs.push({
          ...(base ? { base } : {}),
          head,
          context: head,
          changed: base !== head || changed.has(head),
        });
      }
      continue;
    }
    if (screen.kind === "page") {
      const base =
        baseEntry?.kind === "page"
          ? generatedResourcePath(entryRoute(baseEntry.path))
          : undefined;
      const head = generatedResourcePath(entryRoute(screen.path));
      pairs.push({
        ...(base ? { base } : {}),
        head,
        context: head,
        pagePath: screen.path,
        changed: base !== head || changed.has(head),
      });
      continue;
    }
    if (documents === "pages" || screen.kind !== "screen") continue;
    const base = baseEntry?.kind === "screen" ? baseEntry : undefined;
    for (const viewport of VIEWPORTS) {
      for (const scheme of unionColorSchemes(base, screen)) {
        const before = base
          ? fragmentForView(base, viewport, scheme)
          : undefined;
        const after = fragmentForView(screen, viewport, scheme);
        if (!after) continue;
        pairs.push({
          ...(before ? { base: before } : {}),
          head: after,
          context: `${entryRoute(screen.path)} (${viewport}, ${scheme})`,
          changed: before !== after || changed.has(after),
          view: { path: screen.path, viewport, colorScheme: scheme },
        });
      }
    }
  }
  return pairs;
}

/** Keep only public output evidence before material and resource comparison. */
export function publicChangedRoutes(
  changedPaths: readonly string[],
  config: ResolvedConfig,
): Set<string> {
  return new Set(
    changedPaths.flatMap((changed) => {
      const candidate = path.resolve(config.repoRoot, changed);
      if (
        !isInside(config.mockupsDir, candidate) ||
        (!isInside(config.generatedDir, candidate) &&
          isAuthoringSource(candidate, config, "exclusions") !== undefined)
      )
        return [];
      const route = toPosixPath(path.relative(config.mockupsDir, candidate));
      return route === MANIFEST_NAME ||
        route === generatedResourcePath(MANIFEST_NAME)
        ? []
        : [route];
    }),
  );
}
