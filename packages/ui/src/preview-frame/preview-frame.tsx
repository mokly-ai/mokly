/**
 * The parts of a preview that a canvas frame holds: the scheme of the shown
 * render, and the lines of a preview that is unavailable or that failed to
 * load. `PreviewIframe` draws the `<iframe>` element, whose document the host
 * loads and reads; this package never reads it.
 */

import type { Ref } from "react";

import type { DataAttribute } from "../data-attribute/data-attribute.js";
import { EmptyAction, EmptyLine } from "../empty-state/empty-state.js";

/** The scheme of a render. */
export type FrameScheme = "dark" | "light";

/**
 * How a frame whose document failed to load tries again: the host's callback,
 * or, in a static depiction, the address of the outcome.
 */
export type FrameRetry = { href: string } | { onClick(): void };

/** The line of a preview that has no document to show. */
export function FrameUnavailable() {
  return <EmptyLine>This preview is unavailable.</EmptyLine>;
}

/** The line of a frame whose document failed to load, with Try again. */
export function FrameFailure({
  retry,
}: {
  /** Try again: the host's callback, or the address of the outcome. */
  retry?: FrameRetry | undefined;
}) {
  return (
    <p className="mbk-frame-error mbk-reset" role="status">
      This preview could not be loaded.
      {retry ? (
        <>
          {" "}
          <EmptyAction
            action={
              "href" in retry
                ? { href: retry.href, label: "Try again" }
                : { label: "Try again", onClick: retry.onClick }
            }
          />
        </>
      ) : null}
    </p>
  );
}

/**
 * The line of a frame whose page an earlier version of Mokly built. Trying
 * again cannot help, so the line names the way on instead.
 */
export function FrameOutdated() {
  return (
    <p className="mbk-frame-error mbk-reset" role="status">
      This preview was built with an older version of Mokly. Update Mokly in the
      project, then publish it again.
    </p>
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
      className="mbk-frag mbk-reset"
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
