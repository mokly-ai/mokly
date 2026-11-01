import type { ReactNode } from "react";

import {
  ComparisonLayer,
  ComparisonSurface,
  ComparisonViewport,
  type ComparisonSide,
} from "../../../../../packages/ui/src/comparison-pane/comparison-pane.js";
import { ComparisonPanes } from "../../../../../packages/ui/src/comparison-stage/comparison-stage.js";
import { FrameSettingScope } from "../library/preview/frame_placement.js";

import { FramedShot, type CompareViewport } from "./compare_page.js";

/** The comparison modes that stack both versions in one chrome. */
export type StackedMode = "difference" | "overlay";

/** Draws the one chrome around the viewport both versions share. */
export type StackChrome = (viewport: ReactNode) => ReactNode;

interface ComparisonStackProps {
  /** The Current version, drawn above the Before version. */
  after: ReactNode;
  before: ReactNode;
  chrome: StackChrome;
  mode: StackedMode;
  /** Depicts the shared viewport part-way down content taller than it. */
  scrolled?: boolean | undefined;
}

/**
 * One version's layer: the shipped opaque surface, which holds the depicted
 * document at the drawn scroll position.
 */
function StackedVersion({
  children,
  scrolled,
  side,
}: {
  children: ReactNode;
  scrolled: boolean;
  side: ComparisonSide;
}) {
  return (
    <ComparisonLayer side={side}>
      <ComparisonSurface>
        <div
          className="mbk-stack-document"
          data-scrolled={scrolled ? "" : undefined}
        >
          {children}
        </div>
      </ComparisonSurface>
    </ComparisonLayer>
  );
}

/**
 * Overlay and Difference draw one chrome, a device for a screen or the bordered
 * frame for a saved component variant, whose shipped viewport holds both
 * versions' layers. Both versions therefore always sit at one scroll
 * position: Current on top at half opacity in Overlay, or blended by
 * difference over the opaque Before layer. A static artboard cannot scroll,
 * so a scrolled stack draws the viewport's scrollbar.
 */
export function ComparisonStack({
  after,
  before,
  chrome,
  mode,
  scrolled = false,
}: ComparisonStackProps) {
  return (
    <ComparisonPanes mode={mode}>
      <FrameSettingScope setting="pane">
        {chrome(
          <ComparisonViewport>
            <StackedVersion scrolled={scrolled} side="before">
              {before}
            </StackedVersion>
            <StackedVersion scrolled={scrolled} side="after">
              {after}
            </StackedVersion>
            {scrolled ? (
              <span className="mbk-stack-scrollbar" aria-hidden="true">
                <span className="mbk-stack-thumb" />
              </span>
            ) : null}
          </ComparisonViewport>,
        )}
      </FrameSettingScope>
    </ComparisonPanes>
  );
}

/** A screen's browser window or phone, which follows the preview scheme. */
export function deviceChrome({
  address,
  dark,
  viewport,
}: {
  address: string;
  dark: boolean;
  viewport: CompareViewport;
}): StackChrome {
  return (scroller) => (
    <FramedShot address={address} dark={dark} viewport={viewport}>
      {scroller}
    </FramedShot>
  );
}
