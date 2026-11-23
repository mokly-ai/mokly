/**
 * The Frames filter of the screens: the viewports and the schemes whose
 * frames the canvas shows. Its viewport toggles show and set the public
 * selection's `viewport`: both on is `both`, and one on is that viewport, so
 * an address, a Share link and a host selection keep the shown viewport. Its
 * scheme toggles are one choice of the shell, apart from the public
 * selection: they stay the same across in-shell navigation and start with
 * both schemes shown at a full page load. In the compact layout the
 * selection's viewport names the picked frame, so the picker lists the frames
 * of both viewports. A variant set reads its scheme toggles. A use case keeps
 * a choice of its own, one viewport and one scheme. An axis always keeps one
 * of its toggles on.
 */

import type { ColorScheme, Viewport } from "@mokly/model";
import type { FramesToggleName } from "@mokly/ui/frames-filter";

import type { CanvasShown } from "./canvas_frames.js";
import type { UseCaseFramesChoice } from "./canvas_use_case_frames.js";

/** The toggles of the Frames filter: its shown viewports and schemes. */
export interface FramesChoice {
  dark: boolean;
  desktop: boolean;
  light: boolean;
  mobile: boolean;
}

/** The scheme toggles, which the shell keeps apart from the selection. */
export type FramesSchemes = Pick<FramesChoice, "dark" | "light">;

/** Both schemes shown, as a full page load starts. */
export const BOTH_SCHEMES: FramesSchemes = { dark: true, light: true };

/**
 * The filter's toggles: the shell's scheme toggles, and the viewport toggles
 * of the selection's viewport, where `both` turns both on.
 */
export function framesChoice(
  schemes: FramesSchemes,
  viewport: "both" | Viewport,
): FramesChoice {
  return {
    dark: schemes.dark,
    desktop: viewport !== "mobile",
    light: schemes.light,
    mobile: viewport !== "desktop",
  };
}

/**
 * The scheme toggles and the selection's viewport after one toggle changes:
 * the viewport toggles name `both` while both are on, else the one that is
 * on. A toggle that would leave its axis without a shown frame changes
 * nothing.
 */
export function toggledFilter(
  schemes: FramesSchemes,
  viewport: "both" | Viewport,
  name: FramesToggleName,
  checked: boolean,
): { schemes: FramesSchemes; viewport: "both" | Viewport } {
  const next = toggledFrames(framesChoice(schemes, viewport), name, checked);
  return {
    schemes: { dark: next.dark, light: next.light },
    viewport:
      next.desktop && next.mobile
        ? "both"
        : next.desktop
          ? "desktop"
          : "mobile",
  };
}

/** The other toggle of each toggle's axis. */
const OTHER: Readonly<Record<FramesToggleName, FramesToggleName>> = {
  dark: "light",
  desktop: "mobile",
  light: "dark",
  mobile: "desktop",
};

/**
 * The choice after a toggle changes. A toggle that would leave its axis
 * without a shown frame keeps the choice as it is.
 */
export function toggledFrames(
  choice: FramesChoice,
  name: FramesToggleName,
  checked: boolean,
): FramesChoice {
  if (!checked && !choice[OTHER[name]]) return choice;
  return { ...choice, [name]: checked };
}

/** The viewports that the choice shows, Desktop before Mobile. */
export function shownViewports(choice: FramesChoice): Viewport[] {
  return (["desktop", "mobile"] as const).filter(
    (viewport) => choice[viewport],
  );
}

/**
 * The schemes that the choice shows of an entry, Light before Dark: Light
 * alone for an entry without a dark view, whose Dark toggle reads
 * `Light only`.
 */
export function shownSchemes(
  choice: FramesSchemes,
  hasDark: boolean,
): ColorScheme[] {
  if (!hasDark) return ["light"];
  return (["light", "dark"] as const).filter((scheme) => choice[scheme]);
}

/**
 * The viewports and the schemes whose frames a workspace's canvas lists: on
 * the wide canvas, the ones that the filter shows; in the compact layout, the
 * frames of both viewports, among which the selection's viewport picks the
 * shown one, in the schemes that the filter shows. A variant set's frames
 * show the desktop view.
 */
export function canvasShownAxes(
  choice: FramesChoice,
  entry: { hasDark: boolean; set: boolean; wide: boolean },
): CanvasShown {
  return {
    schemes: shownSchemes(choice, entry.hasDark),
    viewports: entry.set
      ? ["desktop"]
      : entry.wide
        ? shownViewports(choice)
        : ["desktop", "mobile"],
  };
}

/**
 * The views that a workspace shows, whose status, change marks and
 * comparison eligibility the shell describes: on the wide canvas, the
 * selection's viewport and the schemes that the filter shows, the
 * selection's scheme first; in the compact layout, the one picked frame:
 * the selection's viewport, with `both` read as Mobile, in the selection's
 * scheme, or in the other one while the filter hides that one. A variant
 * set's frames show the desktop view.
 */
export function workspaceShownAxes(
  set: boolean,
  choice: FramesSchemes,
  hasDark: boolean,
  wide: boolean,
  selection: { colorScheme: ColorScheme; viewport: "both" | Viewport },
): { schemes: ColorScheme[]; viewport: "both" | Viewport } {
  const schemes = shownSchemes(choice, hasDark).sort(
    (first, second) =>
      Number(second === selection.colorScheme) -
      Number(first === selection.colorScheme),
  );
  const shown = wide ? schemes : schemes.slice(0, 1);
  if (set) return { schemes: shown, viewport: "desktop" };
  if (wide) return { schemes: shown, viewport: selection.viewport };
  // The picker lists Mobile before Desktop.
  return {
    schemes: shown,
    viewport: selection.viewport === "both" ? "mobile" : selection.viewport,
  };
}

/** One view of an entry, named by its viewport and scheme. */
export interface ViewAxes {
  colorScheme: ColorScheme;
  viewport: Viewport;
}

/**
 * Whether a toggle hides a changed view: it is off, and a changed view of
 * the entry lies on its viewport or its scheme.
 */
export function hidesChangedView(
  name: FramesToggleName,
  checked: boolean,
  changed: readonly ViewAxes[],
): boolean {
  if (checked) return false;
  return changed.some((view) =>
    name === "desktop" || name === "mobile"
      ? view.viewport === name
      : view.colorScheme === name,
  );
}

/** A use case's choice after one of its radio buttons is chosen. */
export function chosenUseCase(
  choice: UseCaseFramesChoice,
  name: FramesToggleName,
): UseCaseFramesChoice {
  return name === "desktop" || name === "mobile"
    ? { ...choice, viewport: name }
    : { ...choice, scheme: name };
}
