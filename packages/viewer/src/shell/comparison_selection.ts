/** Pure selection of the views and pane documents one comparison shows. */

import { snapshotViewPath } from "../navigation/routes.js";
import { keepsComponentRecord, viewAxesKey } from "../review/shared_impact.js";
import type { ComparedEntry, ReviewView } from "../review/types.js";

import type { LoadedComparison } from "./comparison_request.js";
import { schemeValue } from "./scheme_fallback.js";
import type { ComparisonPresentation } from "./use_comparison.js";
import { isStyleOnlyView } from "./workspace_style_evidence.js";

/** One viewport section's view and the snapshot addresses of its sides. */
export interface SelectedComparisonView {
  /** Absolute snapshot address of each side the view has. */
  documents: { after?: string; before?: string };
  /**
   * The view is unchanged, yet changed components affect it: it keeps a
   * component-owned record, or its usage holds a changed component that the
   * entry detail names.
   */
  componentsOnly: boolean;
  /** The mode this view shows; one-sided views fall back to Side by side. */
  mode: ComparisonPresentation["mode"];
  /**
   * The view is changed, its entry has a reason, every reason is a
   * dependency, each named path has a rule of any status on this view, and
   * at least one named path has a matched or unresolved rule on this view.
   */
  styleOnly: boolean;
  view: ReviewView;
  viewport: "desktop" | "mobile";
}

/** Resolve a derived snapshot path beneath its comparison's generation. */
function snapshotUrl(
  base: string,
  side: "after" | "before",
  id: string,
  view: ReviewView,
): string {
  const source = snapshotViewPath(side, id, view.viewport, view.colorScheme);
  return new URL(source.split("/").map(encodeURIComponent).join("/"), base)
    .href;
}

/**
 * The views a presentation shows, mobile first, each in the selected scheme
 * or its Light fallback. `undefined` means the routed entry's detail has no
 * ready comparison. `usingChanged` holds the axes keys of the routed views
 * whose usage holds a changed component.
 */
export function selectedComparisonViews(
  loaded: LoadedComparison,
  presentation: ComparisonPresentation,
  entry: ComparedEntry | undefined,
  usingChanged: ReadonlySet<string> = new Set(),
): readonly SelectedComparisonView[] | undefined {
  if (!entry) return;
  return (["mobile", "desktop"] as const).flatMap((viewport) => {
    if (presentation.viewport !== "both" && presentation.viewport !== viewport)
      return [];
    const view = schemeValue(
      presentation.colorScheme,
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport && candidate.colorScheme === "light",
      ),
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport && candidate.colorScheme === "dark",
      ),
    );
    if (!view) return [];
    const before = view.state !== "added";
    const after = view.state !== "removed";
    return [
      {
        documents: {
          ...(before
            ? {
                before: snapshotUrl(loaded.url, "before", entry.basePath, view),
              }
            : {}),
          ...(after
            ? {
                after: snapshotUrl(loaded.url, "after", entry.path, view),
              }
            : {}),
        },
        componentsOnly:
          view.state === "unchanged" &&
          (keepsComponentRecord(view) || usingChanged.has(viewAxesKey(view))),
        mode: before && after ? presentation.mode : "side",
        styleOnly: isStyleOnlyView(view, entry.reasons),
        view,
        viewport,
      },
    ];
  });
}

/** Every pane document the selected views need, in display order. */
export function selectedComparisonDocuments(
  views: readonly SelectedComparisonView[] | undefined,
): readonly string[] {
  return (views ?? []).flatMap(({ documents }) =>
    [documents.before, documents.after].filter(
      (address): address is string => address !== undefined,
    ),
  );
}

/** A frame of the canvas that may compare: its key, its row's entry and its view's axes. */
export interface ComparedFramePlan {
  /** The row whose view the frame shows: a screen, or a row of a variant set. */
  entry: { path: string };
  key: string;
  scheme: "dark" | "light";
  viewport: "desktop" | "mobile";
}

/** What a compared row brings: its comparison facts and the views that use a changed component. */
export interface ComparedRow {
  compared: ComparedEntry;
  /** The axes keys of the row's views whose usage holds a changed component. */
  usingChanged: ReadonlySet<string>;
}

/** One frame of the canvas that compares its row's view. */
export interface ComparedFrame {
  /**
   * The view is unchanged, yet changed components affect it: it keeps a
   * component-owned record, or its usage holds a changed component that the
   * entry detail names.
   */
  componentsOnly: boolean;
  /** The absolute snapshot address of each side that the view has. */
  documents: { after?: string; before?: string };
  /** The row's entry id, which names the generation of its documents. */
  entry: string;
  /** The frame's key among its section's frames. */
  key: string;
  /** Whether the frame shows its viewport's Light view, as its row has no Dark view of it. */
  lightOnly: boolean;
  /** Whether the view's change is only in the styles that its entry uses. */
  styleOnly: boolean;
  view: ReviewView;
}

/** A row's view of a frame's viewport and scheme, or its Light view for a missing Dark view. */
function frameView(
  entry: ComparedEntry,
  frame: ComparedFramePlan,
): { lightOnly: boolean; view: ReviewView } | undefined {
  const of = (scheme: "dark" | "light") =>
    entry.views.find(
      (view) => view.viewport === frame.viewport && view.colorScheme === scheme,
    );
  const own = of(frame.scheme);
  if (own) return { lightOnly: false, view: own };
  const light = frame.scheme === "dark" ? of("light") : undefined;
  return light ? { lightOnly: true, view: light } : undefined;
}

/**
 * The frames that compare, in the frames' order: each frame whose row has a
 * generation and a ready view of the frame's viewport and scheme compares
 * that view, with the documents of the row's generation. Each row finds its
 * generation by its entry id, so a variant set compares every row whose
 * generation the comparison holds.
 */
export function comparedFrames(
  frames: readonly ComparedFramePlan[],
  generations: ReadonlyMap<string, LoadedComparison>,
  rows: (entry: string) => ComparedRow | undefined,
): ComparedFrame[] {
  return frames.flatMap((frame): ComparedFrame[] => {
    const id = frame.entry.path;
    const loaded = generations.get(id);
    const row = loaded ? rows(id) : undefined;
    const shown = row ? frameView(row.compared, frame) : undefined;
    if (!loaded || !row || !shown) return [];
    const { compared } = row;
    const { view } = shown;
    const before = view.state !== "added";
    const after = view.state !== "removed";
    return [
      {
        componentsOnly:
          view.state === "unchanged" &&
          (keepsComponentRecord(view) ||
            row.usingChanged.has(viewAxesKey(view))),
        documents: {
          ...(before
            ? {
                before: snapshotUrl(
                  loaded.url,
                  "before",
                  compared.basePath,
                  view,
                ),
              }
            : {}),
          ...(after
            ? { after: snapshotUrl(loaded.url, "after", compared.path, view) }
            : {}),
        },
        entry: id,
        key: frame.key,
        lightOnly: shown.lightOnly,
        styleOnly: isStyleOnlyView(view, compared.reasons),
        view,
      },
    ];
  });
}

/** The documents of the compared frames, by row, in the frames' order. */
export function comparedRowDocuments(
  frames: readonly Pick<ComparedFrame, "documents" | "entry">[],
): { addresses: string[]; entry: string }[] {
  const rows = new Map<string, string[]>();
  for (const { documents, entry } of frames) {
    const addresses = rows.get(entry) ?? [];
    for (const address of [documents.before, documents.after])
      if (address !== undefined && !addresses.includes(address))
        addresses.push(address);
    rows.set(entry, addresses);
  }
  return [...rows].map(([entry, addresses]) => ({ addresses, entry }));
}
