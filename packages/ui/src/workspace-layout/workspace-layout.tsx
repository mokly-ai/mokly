/**
 * The workspace of a screen or a component. In the Canvas layout the preview
 * fills the canvas, the entry bar of the compact layout stands over its top,
 * and the right panel, which the host gives with its tabs, Inspect and
 * Changes, floats over its right edge. Without the panel the
 * header and the variant bar stand above the panes, where the preview fills
 * the space beside the inspector, as a static depiction of the earlier
 * layout draws them. The preview is busy while a render of it is pending.
 */

import type { ReactNode, Ref } from "react";

export function WorkspaceLayout({
  busy = false,
  entryBar,
  header,
  inspector,
  overlay,
  panel,
  panesRef,
  preview,
  previewRef,
  previewStatus,
  ref,
  variantBar,
}: {
  /** Whether a render of the preview is pending, which marks it busy. */
  busy?: boolean;
  /** The entry bar of the compact layout, such as an `EntryBar`. */
  entryBar?: ReactNode;
  /** The screen header with the workspace's view controls, without `panel`. */
  header?: ReactNode;
  /** The inspector below the preview, without `panel`. */
  inspector?: ReactNode;
  /** Content over the whole workspace, such as the highlight labels. */
  overlay?: ReactNode;
  /**
   * The right panel that floats over the canvas, such as a `FloatingPanel`
   * with the right panel's tabs as its head. With it, the
   * layout leaves `header`, `variantBar` and `inspector` out.
   */
  panel?: ReactNode;
  /** Receives the panes, whose height bounds the inspector's height. */
  panesRef?: Ref<HTMLDivElement> | undefined;
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
  /** The bar of a component's saved variants, without `panel`. */
  variantBar?: ReactNode;
}) {
  const canvas = panel !== undefined;
  return (
    <section
      className="mbk-workspace mbk-reset"
      data-workspace=""
      data-workspace-canvas={canvas ? "" : undefined}
      ref={ref}
    >
      {canvas ? entryBar : header}
      {canvas ? null : variantBar}
      <div className="mbk-workspace-panes mbk-reset" ref={panesRef}>
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
        {canvas ? null : inspector}
      </div>
      {panel}
      {overlay}
    </section>
  );
}
