// The one previous-version presentation shared by removed documents and
// removed screens. The React shell owns the request, lifecycle, and historical
// frames while the server render remains an explicit unavailable state.

import type { RemovedEntryPreview } from "../catalogue/types.js";
import type { PreviewPresentation } from "../previews/presentation.js";
import type { LoadedPreview, PreviewScreenView } from "../previews/request.js";
import type { ManifestEntry } from "../registry/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";
import { PreviewFrame } from "./preview_frame.js";
import { PreviewUnavailable } from "./preview_unavailable.js";
import { useOptionalShellStore } from "./store_context.js";
import { useRemovedPreview } from "./use_removed_preview.js";

/** Everything the browser client needs to request one entry's previous version. */
export interface RemovedPreviewData {
  /** Stable entry id, so a reused route cannot adopt another entry's response. */
  id: string;
  kind: "page" | "screen";
  route: string;
  title: string;
  /** Address shown in a screen preview's browser chrome. */
  address?: string;
  /** The delivery's advertised descriptor; absent when nothing is published. */
  published?: RemovedEntryPreview;
}

/**
 * Describe a removed page or screen from the accepted public catalogue. Static
 * delivery loads only what the catalogue advertises, so an entry without a
 * published descriptor is reported as having none rather than guessing a path.
 */
export function removedPreviewData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: Exclude<ManifestEntry, { kind: "collection" }>,
): RemovedPreviewData | undefined {
  if (entry.kind !== "page" && entry.kind !== "screen") return undefined;
  const model = catalogue.publicModel ?? context.readModel;
  const published = model?.removedEntries.find(
    (removed) => removed.entry.route === entry.route,
  )?.preview;
  return {
    id: entry.id,
    kind: entry.kind,
    route: entry.route,
    title: entry.title,
    ...(entry.kind === "screen" && entry.address
      ? { address: entry.address }
      : {}),
    ...(published ? { published } : {}),
  };
}

/** The quiet band naming what the stage below it holds. */
function PreviousVersionLabel() {
  return <p className="mbk-previous">Showing previous version</p>;
}

function MissingView(props: { viewport: "desktop" | "mobile" }) {
  const other = props.viewport === "desktop" ? "Mobile" : "Desktop";
  return (
    <div className="mbk-preview-state">
      <p className="mbk-preview-note" role="status">
        No previous {props.viewport} version was captured.{" "}
        <span className="mbk-preview-switch">Switch to {other} to see it.</span>
      </p>
    </div>
  );
}

function ScreenFrame(props: {
  data: RemovedPreviewData;
  presentation: PreviewPresentation;
  scheme: "dark" | "light";
  view: PreviewScreenView;
  viewport: "desktop" | "mobile";
}) {
  const fallback = props.view.colorScheme !== props.scheme;
  const content = (
    <PreviewFrame
      presentation={props.presentation}
      title={`${props.data.title} — ${props.viewport}`}
    />
  );
  return (
    <div
      className={`mbk-frame-wrap mbk-frame-${props.viewport}`}
      data-color-scheme-fallback={fallback ? "" : undefined}
    >
      <p className="mbk-frame-label">
        {props.viewport === "mobile" ? "Mobile" : "Desktop"}
        {fallback ? (
          <span className="mbk-frame-scheme-note"> — Light only</span>
        ) : null}
      </p>
      {props.viewport === "mobile" ? (
        <PhoneFrame>{content}</PhoneFrame>
      ) : (
        <BrowserFrame
          address={props.data.address ?? props.data.route}
          expandable={false}
        >
          {content}
        </BrowserFrame>
      )}
    </div>
  );
}

/** Render a loaded preview, or the retryable unavailable state if it is incomplete. */
export function ReadyPreview(props: {
  colorScheme: "dark" | "light";
  data: RemovedPreviewData;
  loaded: LoadedPreview;
  presentations: ReadonlyMap<string, PreviewPresentation>;
  retry(): void;
  viewport: "both" | "desktop" | "mobile";
}) {
  const content = props.loaded.content;
  if (content.kind === "page") {
    const presentation = presentationFor(props.presentations, content.url);
    if (!presentation) return <PreviewUnavailable retry={props.retry} />;
    return (
      <div className="mbk-stage-embed" data-mokly-scroll="embed">
        <PreviewFrame presentation={presentation} title={props.data.title} />
      </div>
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
    if (!view) return <MissingView key={viewport} viewport={viewport} />;
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
    <div
      className="mbk-stage mbk-live"
      data-mokly-scroll="stage"
      data-viewport={props.viewport}
    >
      {frames}
    </div>
  );
}

function presentationFor(
  presentations: ReadonlyMap<string, PreviewPresentation>,
  address: string,
): PreviewPresentation | undefined {
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
  if (preview.state.status === "loading")
    return (
      <div className="mbk-stage">
        <div className="mbk-preview-state">
          <p className="mbk-preview-status" role="status">
            <span aria-hidden="true" className="mbk-preview-spinner" />
            Loading previous version…
          </p>
        </div>
      </div>
    );
  return (
    <PreviewUnavailable
      retry={preview.state.status === "failed" ? preview.retry : undefined}
    />
  );
}

/**
 * The stage a removed entry opens in. The served markup says the previous
 * version is unavailable, because a shell whose client never runs has nothing
 * on the way; the client's first update replaces it with the loading state and
 * then with the previous version, since opening a removed entry is the request.
 */
export function RemovedPreviewStage(props: { data: RemovedPreviewData }) {
  const store = useOptionalShellStore();
  const colorScheme = store?.state.selection.colorScheme ?? "light";
  const viewport = store?.state.selection.viewport ?? "both";
  return (
    <>
      <PreviousVersionLabel />
      <div
        aria-live="polite"
        className="mbk-preview"
        data-mokly-preview={JSON.stringify(props.data)}
        data-mokly-stage=""
        data-viewport={viewport}
      >
        <PreviewState
          colorScheme={colorScheme}
          data={props.data}
          viewport={viewport}
        />
      </div>
      {props.data.kind === "screen" ? (
        <>
          <template data-mokly-preview-template="mobile">
            <PhoneFrame />
          </template>
          <template data-mokly-preview-template="desktop">
            <BrowserFrame
              address={props.data.address ?? props.data.route}
              expandable={false}
            />
          </template>
        </>
      ) : null}
    </>
  );
}
