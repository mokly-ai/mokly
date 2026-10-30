/**
 * The frame of a preview: the wrapper that records the scheme of the shown
 * render, its viewport label with the Light-only note, the device chrome or
 * the document that it holds, and the lines of a preview that is unavailable
 * or that failed to load. `PreviewIframe` draws the `<iframe>` element, whose
 * document the host loads and reads; this package never reads it.
 */

import type { ReactNode, Ref } from "react";

import { EmptyLine } from "../empty-state/empty-state.js";
import { LightOnlyNote } from "../scheme-fallback/scheme-fallback.js";
import type { DataAttribute } from "../segmented-control/segmented-control.js";

/** The viewport of one frame. */
export type FrameViewport = "desktop" | "mobile";

/** The scheme of a render. */
export type FrameScheme = "dark" | "light";

/**
 * Where a preview frame stands: a viewport's `frame` or a component's
 * `canvas` on a stage, the screen of a user flow's step, or the chrome of a
 * comparison pane.
 */
export type FramePlacement =
  | { kind: "canvas" | "frame"; viewport: FrameViewport }
  | { kind: "flow" }
  | { kind: "pane" };

/** The viewport's name above a frame, with the Light-only note. */
function FrameLabel({
  fallback,
  viewport,
}: {
  fallback: boolean;
  viewport: FrameViewport;
}) {
  return (
    <p className="mbk-frame-label">
      {viewport === "mobile" ? "Mobile" : "Desktop"}
      {fallback ? <LightOnlyNote suffix /> : null}
    </p>
  );
}

/**
 * The content of a frame, or the line of a preview that has none, then the
 * line of a frame whose document failed to load.
 */
function FrameContent({
  children,
  error,
}: {
  children: ReactNode;
  error: boolean;
}) {
  return (
    <>
      {children ?? <EmptyLine>This preview is unavailable.</EmptyLine>}
      {error ? (
        <p className="mbk-frame-error" role="status">
          This preview could not be loaded.
        </p>
      ) : null}
    </>
  );
}

/** The class of a frame's wrapper. */
function placementClass(placement: FramePlacement): string {
  if (placement.kind === "flow") return "mbk-flow-screen";
  if (placement.kind === "pane") return "mb-pane-chrome mbk-frame-wrap";
  return `${placement.kind === "canvas" ? "mbk-component-canvas" : "mbk-frame-wrap"} mbk-frame-${placement.viewport}`;
}

/**
 * One preview frame. A frame or a canvas on a stage names its viewport above
 * the content. A view that keeps its light render under a Dark shell carries
 * the fallback mark, which reveals the label's note.
 */
export function PreviewFrame({
  children,
  error = false,
  fallback = false,
  placement,
  scheme,
}: {
  /** The frame in its device chrome. Without it, the preview is unavailable. */
  children?: ReactNode;
  /** Whether the frame's document failed to load. */
  error?: boolean;
  /** Whether the view keeps its light render while the shell is Dark. */
  fallback?: boolean;
  placement: FramePlacement;
  /** The scheme of the shown render, which its frame and chrome follow. */
  scheme: FrameScheme;
}) {
  return (
    <div
      className={placementClass(placement)}
      data-color-scheme-fallback={fallback ? "" : undefined}
      data-preview-color-scheme={scheme}
    >
      {placement.kind === "canvas" || placement.kind === "frame" ? (
        <FrameLabel fallback={fallback} viewport={placement.viewport} />
      ) : null}
      <FrameContent error={error}>{children}</FrameContent>
    </div>
  );
}

/**
 * The frame of a whole document, such as a page or a Markdown document,
 * which fills the stage and keeps its scroll position as `embed`.
 */
export function DocumentFrame({
  children,
  error = false,
  scheme,
}: {
  /** The document's frame. Without it, the preview is unavailable. */
  children?: ReactNode;
  /** Whether the frame's document failed to load. */
  error?: boolean;
  /** The scheme of the shown render. */
  scheme: FrameScheme;
}) {
  return (
    <div
      className="mbk-stage-embed"
      data-mokly-scroll="embed"
      data-preview-color-scheme={scheme}
    >
      <FrameContent error={error}>{children}</FrameContent>
    </div>
  );
}

/**
 * The `<iframe>` element of a preview, sandboxed without scripts. The host
 * passes its document as `src` or `srcDoc` and the attributes through which
 * it finds and drives the frame, and it reads the document through `ref`.
 */
export function PreviewIframe({
  busy = false,
  data,
  ref,
  scrollable = true,
  src,
  srcDoc,
  title,
}: {
  /** Whether the frame's document is loading. */
  busy?: boolean;
  /**
   * The data attributes of the frame, such as `data-mokly-frame-state`, in
   * the order that the frame carries them. An undefined value is left out.
   */
  data?: Readonly<Partial<Record<DataAttribute, string | undefined>>>;
  /** Receives the `<iframe>` element. */
  ref?: Ref<HTMLIFrameElement> | undefined;
  /**
   * Whether the reader can scroll the frame. A comparison pane scrolls its
   * frame's document from its own viewport instead.
   */
  scrollable?: boolean;
  /** The address of a live document. */
  src?: string | undefined;
  /** The markup of a captured document. */
  srcDoc?: string | undefined;
  title: string;
}) {
  return (
    <iframe
      aria-busy={busy ? true : undefined}
      className="mbk-frag"
      {...data}
      ref={ref}
      sandbox="allow-same-origin"
      scrolling={scrollable ? undefined : "no"}
      src={src}
      srcDoc={srcDoc}
      title={title}
    />
  );
}
