// The one previous-version presentation shared by removed documents and
// removed screens. The React shell owns the request, lifecycle, and historical
// frames; a shell without a request shows the explicit unavailable state.
// `@mokly/ui/previous-version` draws the band and the stage host,
// `@mokly/ui/preview-state` the loading and missing states, and
// `@mokly/ui/preview-frame` and `@mokly/ui/device-frame` the frames.

import { PhoneFrame } from "@mokly/ui/device-frame";
import { DocumentFrame, PreviewFrame } from "@mokly/ui/preview-frame";
import { PreviewLoading, PreviewNotCaptured } from "@mokly/ui/preview-state";
import { PreviousVersion } from "@mokly/ui/previous-version";
import { Stage } from "@mokly/ui/stage";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import type { RemovedEntryPreview } from "../catalogue/types.js";
import { entryRoute } from "../navigation/routes.js";
import type { SnapshotPresentation } from "../previews/presentation.js";
import type { LoadedPreview, PreviewScreenView } from "../previews/request.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { BrowserFrame } from "./frames.js";
import { SnapshotFrame } from "./preview_frame.js";
import { PreviewUnavailable } from "./preview_unavailable.js";
import { documentLightOnly } from "./scheme_fallback.js";
import { useOptionalShellStore } from "./store_context.js";
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
  /** Address shown in a screen preview's browser chrome. */
  address?: string;
  /** The delivery's advertised descriptor; absent when nothing is published. */
  published?: RemovedEntryPreview;
  /** A document with no historical dark render in a catalogue with Dark. */
  lightOnly?: true;
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
    ...(entry.kind === "screen" && entry.address
      ? { address: entry.address }
      : {}),
    ...(published ? { published } : {}),
    ...(documentLightOnly(entry, catalogue.hasDarkFragments)
      ? { lightOnly: true as const }
      : {}),
  };
}

function ScreenFrame(props: {
  data: RemovedPreviewData;
  presentation: SnapshotPresentation;
  scheme: "dark" | "light";
  view: PreviewScreenView;
  viewport: "desktop" | "mobile";
}) {
  const content = (
    <SnapshotFrame
      presentation={props.presentation}
      title={`${props.data.title} — ${props.viewport}`}
    />
  );
  return (
    <PreviewFrame
      fallback={props.view.colorScheme !== props.scheme}
      placement={{ kind: "frame", viewport: props.viewport }}
      scheme={props.view.colorScheme}
    >
      {props.viewport === "mobile" ? (
        <PhoneFrame>{content}</PhoneFrame>
      ) : (
        <BrowserFrame
          address={props.data.address ?? entryRoute(props.data.path)}
          expandable={false}
        >
          {content}
        </BrowserFrame>
      )}
    </PreviewFrame>
  );
}

/** Render a loaded preview, or the retryable unavailable state if it is incomplete. */
export function ReadyPreview(props: {
  colorScheme: "dark" | "light";
  data: RemovedPreviewData;
  loaded: LoadedPreview;
  presentations: ReadonlyMap<string, SnapshotPresentation>;
  retry(): void;
  viewport: "both" | "desktop" | "mobile";
}) {
  const content = props.loaded.content;
  if (content.kind === "page" || content.kind === "document") {
    const view =
      content.kind === "document"
        ? (content.views.find(
            (view) => view.colorScheme === props.colorScheme,
          ) ?? content.views[0]!)
        : { url: content.url, colorScheme: "light" as const };
    const presentation = presentationFor(props.presentations, view.url);
    if (!presentation) return <PreviewUnavailable retry={props.retry} />;
    return (
      <DocumentFrame scheme={view.colorScheme}>
        <SnapshotFrame presentation={presentation} title={props.data.title} />
      </DocumentFrame>
    );
  }
  const viewports =
    props.viewport === "both"
      ? (["mobile", "desktop"] as const)
      : ([props.viewport] as const);
  const frames = viewports.map((viewport) => {
    const view =
      content.views.find(
        (item) =>
          item.viewport === viewport && item.colorScheme === props.colorScheme,
      ) ??
      content.views.find(
        (item) => item.viewport === viewport && item.colorScheme === "light",
      );
    if (!view) return <PreviewNotCaptured key={viewport} viewport={viewport} />;
    const presentation = presentationFor(props.presentations, view.url);
    return presentation ? (
      <ScreenFrame
        data={props.data}
        key={viewport}
        presentation={presentation}
        scheme={props.colorScheme}
        view={view}
        viewport={viewport}
      />
    ) : undefined;
  });
  if (frames.some((frame) => frame === undefined))
    return <PreviewUnavailable retry={props.retry} />;
  return (
    <Stage kind="live" viewport={props.viewport}>
      {frames}
    </Stage>
  );
}

function presentationFor(
  presentations: ReadonlyMap<string, SnapshotPresentation>,
  address: string,
): SnapshotPresentation | undefined {
  return presentations.get(address);
}

function PreviewState(props: {
  colorScheme: "dark" | "light";
  data: RemovedPreviewData;
  viewport: "both" | "desktop" | "mobile";
}) {
  const store = useOptionalShellStore();
  const preview = useRemovedPreview({
    colorScheme: props.colorScheme,
    data: props.data,
    interactive: store?.interactive ?? false,
    viewport: props.viewport,
  });
  if (preview.state.status === "ready")
    return (
      <ReadyPreview
        colorScheme={props.colorScheme}
        data={props.data}
        loaded={preview.state.loaded}
        presentations={preview.state.presentations}
        retry={preview.retry}
        viewport={props.viewport}
      />
    );
  if (preview.state.status === "loading") return <PreviewLoading />;
  return (
    <PreviewUnavailable
      retry={preview.state.status === "failed" ? preview.retry : undefined}
    />
  );
}

/**
 * The stage a removed entry opens in. Opening a removed entry is the request:
 * the stage shows the loading state, then the previous version. A shell that
 * cannot request it shows that the previous version is unavailable.
 */
export function RemovedPreviewStage(props: { data: RemovedPreviewData }) {
  const store = useOptionalShellStore();
  const colorScheme = store?.state.selection.colorScheme ?? "light";
  const viewport = store?.state.selection.viewport ?? "both";
  return (
    <PreviousVersion
      descriptor={JSON.stringify(props.data)}
      lightOnly={props.data.lightOnly === true}
      viewport={viewport}
    >
      <PreviewState
        colorScheme={colorScheme}
        data={props.data}
        viewport={viewport}
      />
    </PreviousVersion>
  );
}
