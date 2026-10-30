/**
 * The previous version of a removed page, document, or screen: the quiet
 * band that names what the stage holds, and the stage host, which carries
 * the descriptor of the preview request and announces each state of it.
 */

import type { ReactNode } from "react";

import { LightOnlyNote } from "../scheme-fallback/scheme-fallback.js";

/**
 * The band and the stage host. A light-only document adds the note to the
 * band, which the stylesheet shows only while the shell is Dark.
 */
export function PreviousVersion({
  children,
  descriptor,
  lightOnly = false,
  viewport,
}: {
  /** The state of the preview: loading, unavailable, or its frames. */
  children?: ReactNode;
  /** The preview request, which the host carries in `data-mokly-preview`. */
  descriptor: string;
  /** Whether the document has no dark render while the catalogue has one. */
  lightOnly?: boolean;
  /** The shown viewport. */
  viewport: "both" | "desktop" | "mobile";
}) {
  return (
    <>
      <p
        className="mbk-previous"
        data-color-scheme-fallback={lightOnly ? "" : undefined}
      >
        Showing previous version
        {lightOnly ? <LightOnlyNote suffix /> : null}
      </p>
      <div
        aria-live="polite"
        className="mbk-preview"
        data-mokly-preview={descriptor}
        data-mokly-stage=""
        data-viewport={viewport}
      >
        {children}
      </div>
    </>
  );
}
