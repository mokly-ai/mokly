/**
 * The workspace of a screen or a component: its header, the variant bar, and
 * the panes, where the preview fills the space beside the inspector. The
 * preview is busy while a render of it is pending.
 */

import type { ReactNode, Ref } from "react";

export function WorkspaceLayout({
  busy = false,
  header,
  inspector,
  overlay,
  preview,
  previewStatus,
  ref,
  variantBar,
}: {
  /** Whether a render of the preview is pending, which marks it busy. */
  busy?: boolean;
  /** The screen header with the workspace's view controls. */
  header: ReactNode;
  inspector: ReactNode;
  /** Content over the whole workspace, such as the highlight labels. */
  overlay?: ReactNode;
  /** The preview: the stage, or the comparison around it. */
  preview: ReactNode;
  /** The status of a render, which shows over the preview. */
  previewStatus?: ReactNode;
  /** Receives the workspace, which the host sizes and searches. */
  ref?: Ref<HTMLElement> | undefined;
  /** The bar of a component's saved variants. */
  variantBar?: ReactNode;
}) {
  return (
    <section className="mbk-workspace" data-workspace="" ref={ref}>
      {header}
      {variantBar}
      <div className="mbk-workspace-panes">
        <div className="mbk-preview-pane" data-workspace-preview="">
          <div aria-busy={busy ? true : undefined} className="mbk-preview-busy">
            {preview}
          </div>
          {previewStatus}
        </div>
        {inspector}
      </div>
      {overlay}
    </section>
  );
}
