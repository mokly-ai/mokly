/**
 * The dock of the compact layout: a raised group named `Canvas controls`
 * that floats at the bottom centre of the canvas, with 44px targets.
 * Catalogue opens the catalogue sheet. The right panel's current tab, which
 * names what a tap on a frame does, opens the panel sheet. Fit refits the
 * shown frame. The dock shows below the layout breakpoint only, where it
 * takes the zoom pill's place. In a static depiction that runs no script,
 * each control is a picture of itself.
 */

import type { ReactNode, Ref } from "react";

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

/**
 * The picture of a control in a static depiction: the control's look,
 * named by what it would do, with no tab stop and no pointer.
 */
function DockPicture({
  children,
  className = "mbk-dock-control mbk-reset",
  control,
  label,
}: {
  children: ReactNode;
  className?: string;
  control: string;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      className={className}
      data-dock-control={control}
      role="img"
      title={label}
    >
      {children}
    </span>
  );
}

export function CanvasDock({
  catalogueRef,
  interactive = true,
  onCatalogue,
  onFit,
  onTab,
  tab,
  tabRef,
}: {
  /** Receives Catalogue, which the host focuses when a sheet closes. */
  catalogueRef?: Ref<HTMLButtonElement> | undefined;
  /**
   * Whether the controls are buttons, as they are by default. A static
   * depiction that runs no script sets `false`, which draws each control as
   * a picture of itself; the refs then receive nothing.
   */
  interactive?: boolean;
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
  const shown = tab === undefined ? undefined : { id: tab, ...TABS[tab] };
  const catalogue = (
    <>
      <CanvasIcon name="layers" size={19} />
      Catalogue
    </>
  );
  const fit = <CanvasIcon name="fit" size={19} />;
  return (
    <div
      aria-label="Canvas controls"
      className="mbk-dock mbk-reset"
      data-canvas-dock=""
      role="group"
    >
      {interactive ? (
        <button
          className="mbk-dock-control mbk-reset"
          data-dock-control="catalogue"
          onClick={onCatalogue}
          ref={catalogueRef}
          type="button"
        >
          {catalogue}
        </button>
      ) : (
        <DockPicture control="catalogue" label="Catalogue">
          {catalogue}
        </DockPicture>
      )}
      {shown === undefined ? null : (
        <>
          <span aria-hidden="true" className="mbk-dock-rule mbk-reset" />
          {interactive ? (
            <button
              className="mbk-dock-control mbk-reset"
              data-dock-control={shown.id}
              onClick={onTab}
              ref={tabRef}
              type="button"
            >
              <CanvasIcon name={shown.icon} size={19} />
              {shown.label}
            </button>
          ) : (
            <DockPicture control={shown.id} label={shown.label}>
              <CanvasIcon name={shown.icon} size={19} />
              {shown.label}
            </DockPicture>
          )}
        </>
      )}
      {onFit === undefined ? null : (
        <>
          <span aria-hidden="true" className="mbk-dock-rule mbk-reset" />
          {interactive ? (
            <button
              aria-label="Fit"
              className="mbk-dock-control mbk-dock-fit mbk-reset"
              data-dock-control="fit"
              onClick={onFit}
              title="Fit"
              type="button"
            >
              {fit}
            </button>
          ) : (
            <DockPicture
              className="mbk-dock-control mbk-dock-fit mbk-reset"
              control="fit"
              label="Fit"
            >
              {fit}
            </DockPicture>
          )}
        </>
      )}
    </div>
  );
}
