/** Centered spinner line shown while a preview is on its way. */

import type { ReactNode } from "react";

/** One status line with the Changes spinner treatment, centered in its area. */
export function PreviewProgress({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        className ? `mbk-preview-state ${className}` : "mbk-preview-state"
      }
    >
      <p className="mbk-preview-status" role="status">
        <span aria-hidden="true" className="mbk-preview-spinner" />
        {children}
      </p>
    </div>
  );
}
