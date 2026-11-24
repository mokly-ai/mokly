/**
 * The workspace of a screen or a component on the canvas: the preview fills
 * the canvas, the entry bar of the compact layout stands over its top, and
 * the right panel, which the host gives with its tabs, Inspect and Changes,
 * floats over its right edge. The preview is busy while a render of it is
 * pending.
 */

import type { ReactNode, Ref } from "react";

export function WorkspaceLayout({
  busy = false,
  entryBar,
  overlay,
  panel,
  preview,
  previewRef,
  previewStatus,
  ref,
}: {
  /** Whether a render of the preview is pending, which marks it busy. */
  busy?: boolean;
  /** The entry bar of the compact layout, such as an `EntryBar`. */
  entryBar?: ReactNode;
  /** Content over the whole workspace, such as the highlight labels. */
  overlay?: ReactNode;
  /**
   * The right panel that floats over the canvas, such as a `FloatingPanel`
   * with the right panel's tabs as its head.
   */
  panel?: ReactNode;
  /** The preview: the stage, or the comparison around it. */
  preview: ReactNode;
  /**
   * Receives the preview pane, against which the host measures and clips the
   * frames on it.
   */
  previewRef?: Ref<HTMLDivElement> | undefined;
  /** The status of a render, which shows over the preview. */
  previewStatus?: ReactNode;
  /** Receives the workspace, which the host sizes and searches. */
  ref?: Ref<HTMLElement> | undefined;
}) {
  return (
    <section
      className="mbk-workspace mbk-reset"
      data-workspace=""
      data-workspace-canvas=""
      ref={ref}
    >
      {entryBar}
      <div className="mbk-workspace-panes mbk-reset">
        <div
          className="mbk-preview-pane mbk-reset"
          data-workspace-preview=""
          ref={previewRef}
        >
          <div
            aria-busy={busy ? true : undefined}
            className="mbk-preview-busy mbk-reset"
          >
            {preview}
          </div>
          {previewStatus}
        </div>
      </div>
      {panel}
      {overlay}
    </section>
  );
}
