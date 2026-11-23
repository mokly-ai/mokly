/**
 * The Frames filter of the screens: the viewports and the schemes whose
 * frames the canvas shows. It is one choice of the shell, apart from the
 * public selection: it stays the same across in-shell navigation and starts
 * with every frame shown at a full page load. A variant set reads its scheme
 * toggles. A use case keeps a choice of its own, one viewport and one
 * scheme. An axis always keeps one of its toggles on.
 */

import type { ColorScheme, Viewport } from "@mokly/model";
import type { FramesToggleName } from "@mokly/ui/frames-filter";

import type { UseCaseFramesChoice } from "./canvas_use_case_frames.js";

/** The shown viewports and schemes of the Frames filter. */
export interface FramesChoice {
  dark: boolean;
  desktop: boolean;
  light: boolean;
  mobile: boolean;
}

/** Every frame shown, as a full page load starts. */
export const ALL_FRAMES: FramesChoice = {
  dark: true,
  desktop: true,
  light: true,
  mobile: true,
};

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
  choice: FramesChoice,
  hasDark: boolean,
): ColorScheme[] {
  if (!hasDark) return ["light"];
  return (["light", "dark"] as const).filter((scheme) => choice[scheme]);
}

/**
 * The views that a workspace shows, whose status, change marks and
 * comparison eligibility the shell describes: on the wide canvas, the
 * viewports and schemes that the filter shows, the selection's scheme
 * first; in the compact layout, the one picked frame, which the selection's
 * viewport and scheme name, or the first shown frame while the filter hides
 * that one. A variant set's frames show the desktop view.
 */
export function workspaceShownAxes(
  set: boolean,
  choice: FramesChoice,
  hasDark: boolean,
  wide: boolean,
  selection: { colorScheme: ColorScheme; viewport: "both" | Viewport },
): { schemes: ColorScheme[]; viewport: "both" | Viewport } {
  const schemes = shownSchemes(choice, hasDark).sort(
    (first, second) =>
      Number(second === selection.colorScheme) -
      Number(first === selection.colorScheme),
  );
  const viewports: readonly Viewport[] = set
    ? ["desktop"]
    : shownViewports(choice);
  if (wide)
    return {
      schemes,
      viewport: viewports.length > 1 ? "both" : (viewports[0] ?? "desktop"),
    };
  // The picker lists Mobile before Desktop.
  const wanted = selection.viewport === "both" ? "mobile" : selection.viewport;
  const viewport = viewports.includes(wanted)
    ? wanted
    : viewports.includes("mobile")
      ? "mobile"
      : (viewports[0] ?? wanted);
  return { schemes: schemes.slice(0, 1), viewport };
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
