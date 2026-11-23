/**
 * The host of a removed entry's previous version on the canvas. It carries
 * the descriptor of the preview request and announces each state of it,
 * around the canvas that holds the section of the historical views, or the
 * loading or the failure state in place of the section.
 */

import type { ReactNode } from "react";

export function CanvasPreviousVersion({
  children,
  descriptor,
}: {
  /** The canvas of the preview's state. */
  children?: ReactNode;
  /** The preview request, which the host carries in `data-mokly-preview`. */
  descriptor: string;
}) {
  return (
    <div
      aria-live="polite"
      className="mbk-canvas-previous mbk-reset"
      data-mokly-preview={descriptor}
    >
      {children}
    </div>
  );
}
