// The one previous-version presentation shared by removed documents and
// removed screens. The React shell owns the request, lifecycle, and historical
// frames; a shell without a request shows the explicit unavailable state.
// `@mokly/ui/canvas-previous-version` draws the host of the request, and
// `canvas_removed.tsx` the canvas that holds the section of the historical
// views, or the loading or unavailable state in place of the section.

import { CanvasPreviousVersion } from "@mokly/ui/canvas-previous-version";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { RemovedEntryPreview } from "../catalogue/types.js";

import { readingFrameLabel } from "./canvas_frames.js";
import { CanvasRemovedStage } from "./canvas_removed.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { documentLightOnly } from "./scheme_fallback.js";
import { useShellStore } from "./store_context.js";
import { useRemovedPreview } from "./use_removed_preview.js";

/** Everything the browser client needs to request one entry's previous version. */
export interface RemovedPreviewData {
  /** Stable entry id, so another entry cannot adopt this response. */
  path: string;
  kind: "page" | "document" | "screen";
  colorSchemes?: readonly ("light" | "dark")[];
  title: string;
  /** Catalogue that owns the selected historical record. */
  catalogueIdentity?: string;
  /** Exact historical record whose preview bytes may be displayed. */
  snapshotId?: string;
  /** The delivery's advertised descriptor; absent when nothing is published. */
  published?: RemovedEntryPreview;
  /** A document with no historical dark render in a catalogue with Dark. */
  lightOnly?: true;
  /** The name of a page's or a document's reading frame: its source file. */
  readingLabel?: string;
}

/**
 * Describe a removed page or screen from the accepted public catalogue. Static
 * delivery loads only what the catalogue advertises, so an entry without a
 * published descriptor is reported as having none rather than guessing a path.
 */
export function removedPreviewData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: ShellCatalogueRoutedEntry,
): RemovedPreviewData | undefined {
  if (
    entry.kind !== "page" &&
    entry.kind !== "document" &&
    entry.kind !== "screen"
  )
    return undefined;
  const model = catalogue.publicModel;
  const removed = model.removedEntries.find(
    (removed) => removed.entry.path === entry.path,
  );
  const published = removed?.preview;
  return {
    path: entry.path,
    kind: entry.kind,
    title: entry.title,
    ...(entry.kind === "document" ? { colorSchemes: entry.colorSchemes } : {}),
    ...(removed?.snapshotId
      ? {
          catalogueIdentity: model.identity.id,
          snapshotId: removed.snapshotId,
        }
      : {}),
    ...(published ? { published } : {}),
    ...(documentLightOnly(entry, catalogue.hasDarkFragments)
      ? { lightOnly: true as const }
      : {}),
    ...(entry.kind === "screen"
      ? {}
      : { readingLabel: readingFrameLabel(entry) }),
  };
}

/**
 * The stage a removed entry opens in. Opening a removed entry is the request:
 * the canvas holds the loading state, then the section of the previous
 * version. A shell that cannot request it shows that the previous version is
 * unavailable.
 */
export function RemovedPreviewStage(props: { data: RemovedPreviewData }) {
  const store = useShellStore();
  const { colorScheme, viewport } = store.state.selection;
  const preview = useRemovedPreview({
    colorScheme,
    data: props.data,
    interactive: store.interactive,
    viewport,
  });
  return (
    <CanvasPreviousVersion descriptor="">
      <CanvasRemovedStage
        colorScheme={colorScheme}
        data={props.data}
        retry={preview.retry}
        state={preview.state}
        viewport={viewport}
      />
    </CanvasPreviousVersion>
  );
}
