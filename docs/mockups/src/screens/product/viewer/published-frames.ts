import type { ColorScheme, Viewport } from "@mokly/mokly";
import type { ChangeStatusValue } from "@mokly/ui/change-status";
import type { EntryBarFrame } from "@mokly/ui/entry-bar";

import { currentScreen } from "../../../fixtures/viewer-catalogue";

/**
 * The nominal size of a screen's frame of each viewport on the canvas, in CSS
 * pixels, which the viewer gives a screen's frames.
 */
export const frameSizes: Readonly<
  Record<Viewport, { width: number; height: number }>
> = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

/** One frame of the current screen's section: one viewport in one scheme. */
export interface ScreenFrame {
  /** Names the frame among its section's frames, such as `mobile-dark`. */
  key: string;
  viewport: Viewport;
  scheme: ColorScheme;
  /** The frame's name, such as `Desktop · Light`. */
  label: string;
  column: number;
  row: number;
  /** Whether the frame's view changed since the publication's base. */
  changed: boolean;
}

const viewportNames = { desktop: "Desktop", mobile: "Mobile" } as const;
const schemeNames = { light: "Light", dark: "Dark" } as const;

/** Whether the current screen has a dark view. */
export const hasDark = currentScreen.views.some(
  ({ scheme }) => scheme === "dark",
);

/** The schemes of the current screen's rows: Light, and Dark if it has one. */
const schemes: readonly ColorScheme[] = hasDark ? ["light", "dark"] : ["light"];

/**
 * The current screen's frames on the wide canvas, as the viewer lays out a
 * screen: Desktop beside Mobile, the Light row above the Dark row, and only
 * the Light row without a dark view. The drawing's Frames filter shows every
 * viewport and scheme, so every frame shows.
 */
export const screenFrames: readonly ScreenFrame[] = schemes.flatMap(
  (scheme, row) =>
    (["desktop", "mobile"] as const).map((viewport, column) => ({
      key: viewport + "-" + scheme,
      viewport,
      scheme,
      label: viewportNames[viewport] + " · " + schemeNames[scheme],
      column,
      row,
      changed: currentScreen.views.some(
        (view) =>
          view.viewport === viewport &&
          view.scheme === scheme &&
          view.change === "changed",
      ),
    })),
);

/** The current screen's frame of one viewport and one scheme. */
function frameOf(viewport: Viewport, scheme: ColorScheme): ScreenFrame {
  const frame = screenFrames.find(
    (candidate) =>
      candidate.viewport === viewport && candidate.scheme === scheme,
  );
  if (frame === undefined)
    throw new Error("The " + viewport + " " + scheme + " frame is missing.");
  return frame;
}

/**
 * The one frame that the compact layout shows on a phone, as the viewer
 * picks it: the mobile frame of the document's scheme, or the mobile Light
 * frame of a screen without a dark view. It stands alone in the section's
 * first cell, and the entry's slug leads its name, such as
 * `home · Mobile · Light`.
 */
export function pickedFrame(scheme: ColorScheme): ScreenFrame {
  const frame = frameOf("mobile", hasDark ? scheme : "light");
  const slug = currentScreen.path.split("/").at(-1) ?? currentScreen.path;
  return {
    ...frame,
    label: slug + " · " + frame.label,
    column: 0,
    row: 0,
  };
}

/**
 * The frames that the compact layout's frame picker lists, in the viewer's
 * order: Mobile before Desktop, and Light before Dark.
 */
export const pickerFrames: readonly EntryBarFrame[] = (
  ["mobile", "desktop"] as const
).flatMap((viewport) =>
  schemes.map((scheme) => {
    const frame = frameOf(viewport, scheme);
    return { kind: viewport, label: frame.label, value: frame.key };
  }),
);

/**
 * The status of the shown frames, as the viewer gives the section, the entry
 * bar and Inspect: Changed while a shown frame's view changed, else
 * Unmodified. Every view of the fixture records its change, so the rule's
 * fallback to the entry's own status does not arise.
 */
export function shownStatus(frames: readonly ScreenFrame[]): ChangeStatusValue {
  return frames.some(({ changed }) => changed) ? "Changed" : "Unmodified";
}

/**
 * The changed views of the current screen named for the reader, as Inspect's
 * Changed views row lists them, such as `Desktop · Light, Mobile · Light`.
 */
export const changedViews: string = currentScreen.views
  .filter(({ change }) => change === "changed")
  .map(
    ({ viewport, scheme }) =>
      viewportNames[viewport] + " · " + schemeNames[scheme],
  )
  .join(", ");

/** The schemes that the current screen renders in, named for the reader. */
export const screenSchemes: string = schemes
  .map((scheme) => schemeNames[scheme])
  .join(", ");
