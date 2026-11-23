/**
 * The dock of the compact layout: a raised group named `Canvas controls`
 * that floats at the bottom centre of the canvas, with 44px targets.
 * Catalogue opens the catalogue sheet. The right panel's current tab, which
 * names what a tap on a frame does, opens the panel sheet. Fit refits the
 * shown frame. The dock shows below the layout breakpoint only, where it
 * takes the zoom pill's place.
 */

import type { Ref } from "react";

import { CanvasIcon, type CanvasIconName } from "../icons/canvas-icons.js";

/** A tab of the right panel, which the dock names and opens. */
export type CanvasDockTab = "changes" | "inspect";

/** The name and the glyph of each tab, as the dock shows it. */
const TABS: Readonly<
  Record<CanvasDockTab, { icon: CanvasIconName; label: string }>
> = {
  changes: { icon: "changes", label: "Changes" },
  inspect: { icon: "inspect", label: "Inspect" },
};

export function CanvasDock({
  catalogueRef,
  onCatalogue,
  onFit,
  onTab,
  tab,
  tabRef,
}: {
  /** Receives Catalogue, which the host focuses when a sheet closes. */
  catalogueRef?: Ref<HTMLButtonElement> | undefined;
  /** Receives each press of Catalogue. */
  onCatalogue(): void;
  /**
   * Receives each press of Fit. Without it the dock has no Fit, as while the
   * canvas holds no section.
   */
  onFit?: (() => void) | undefined;
  /** Receives each press of the tab. */
  onTab?: (() => void) | undefined;
  /**
   * The right panel's current tab. Without it the dock holds no tab, as with
   * nothing selected.
   */
  tab?: CanvasDockTab | undefined;
  /** Receives the tab's control, which the host focuses when a sheet closes. */
  tabRef?: Ref<HTMLButtonElement> | undefined;
}) {
  const shown = tab === undefined ? undefined : TABS[tab];
  return (
    <div
      aria-label="Canvas controls"
      className="mbk-dock mbk-reset"
      data-canvas-dock=""
      role="group"
    >
      <button
        className="mbk-dock-control mbk-reset"
        data-dock-control="catalogue"
        onClick={onCatalogue}
        ref={catalogueRef}
        type="button"
      >
        <CanvasIcon name="layers" size={19} />
        Catalogue
      </button>
      {shown === undefined ? null : (
        <>
          <span aria-hidden="true" className="mbk-dock-rule mbk-reset" />
          <button
            className="mbk-dock-control mbk-reset"
            data-dock-control={tab}
            onClick={onTab}
            ref={tabRef}
            type="button"
          >
            <CanvasIcon name={shown.icon} size={19} />
            {shown.label}
          </button>
        </>
      )}
      {onFit === undefined ? null : (
        <>
          <span aria-hidden="true" className="mbk-dock-rule mbk-reset" />
          <button
            aria-label="Fit"
            className="mbk-dock-control mbk-dock-fit mbk-reset"
            data-dock-control="fit"
            onClick={onFit}
            title="Fit"
            type="button"
          >
            <CanvasIcon name="fit" size={19} />
          </button>
        </>
      )}
    </div>
  );
}
