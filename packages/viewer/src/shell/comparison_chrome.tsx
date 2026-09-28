/** The chrome around a comparison viewport and the documents shown inside it. */

import type { ReactNode } from "react";

import type { SnapshotPresentation } from "../previews/presentation.js";
import type { ViewReview } from "../review/types.js";

import type { ComparisonSide } from "./comparison_scroll_owner.js";
import { BrowserFrame, PhoneFrame } from "./frames.js";

/** Draws one chrome around the viewport it is given. */
export type ComparisonChrome = (viewport: ReactNode) => ReactNode;

/** One version's accepted presentation and the frame title naming it. */
export interface PaneDocument {
  presentation: SnapshotPresentation;
  /** Which version the document is. */
  side: ComparisonSide;
  title: string;
}

/**
 * The browser window for desktop, the phone for mobile, or the bordered
 * component frame for a saved variant. Browser expansion is never offered
 * outside Current, so a comparison cannot misalign one version alone.
 */
export function comparisonChrome(
  component: boolean,
  viewport: "desktop" | "mobile",
  address: string,
): ComparisonChrome {
  if (component)
    return (content) => <div className="mb-component-frame">{content}</div>;
  if (viewport === "mobile")
    return (content) => <PhoneFrame>{content}</PhoneFrame>;
  return (content) => (
    <BrowserFrame address={address} expandable={false}>
      {content}
    </BrowserFrame>
  );
}

/** Carries the view's scheme to the chrome, its viewport and its frames. */
export function ChromeScheme({
  children,
  view,
}: {
  children: ReactNode;
  view: ViewReview;
}) {
  return (
    <div
      className="mb-pane-chrome mbk-frame-wrap"
      data-color-scheme-fallback={view.colorScheme === "light" ? "" : undefined}
      data-preview-color-scheme={view.colorScheme}
    >
      {children}
    </div>
  );
}
