/**
 * The frames of a use case on the canvas: one step frame for each step, in
 * step order, in one row from left to right. Every step frame shows its step
 * screen's view of the one viewport and the one scheme that the use case's
 * own Frames choice holds. A step whose screen has no dark view of that
 * viewport keeps its Light view while Dark is chosen. Each step frame is
 * named by its step's number and title, as the compact frame picker lists it.
 */

import type { CatalogueUseCase } from "@mokly/model";

import type { ShellCatalogueScreen } from "../catalogue/scoped_types.js";

import type {
  CanvasFramePlan,
  CanvasScheme,
  CanvasStepPlan,
} from "./canvas_frames.js";
import { schemeValue } from "./scheme_fallback.js";

/**
 * A use case's own Frames choice: one viewport and one scheme, which every
 * step shows. The use case keeps it apart from a screen's frames and from the
 * selection's preview scheme.
 */
export interface UseCaseFramesChoice {
  scheme: CanvasScheme;
  viewport: "desktop" | "mobile";
}

/** A step frame: the frame of one step, which shows a screen's view. */
export type UseCaseFramePlan = CanvasFramePlan & {
  entry: ShellCatalogueScreen;
  step: CanvasStepPlan;
};

/**
 * The choice that a use case opens on: Desktop and Light at and above the
 * layout breakpoint, and Mobile and Light in the compact layout.
 */
export function openingUseCaseChoice(wide: boolean): UseCaseFramesChoice {
  return { scheme: "light", viewport: wide ? "desktop" : "mobile" };
}

/** One step's frame, before the row gives it its column. */
function stepFrame(
  screen: ShellCatalogueScreen,
  step: CatalogueUseCase["steps"][number],
  index: number,
  choice: UseCaseFramesChoice,
): Omit<UseCaseFramePlan, "column"> {
  const view = (scheme: CanvasScheme) =>
    screen.views.find(
      (candidate) =>
        candidate.viewport === choice.viewport &&
        candidate.colorScheme === scheme,
    );
  const light = view("light");
  const dark = view("dark");
  const shown = schemeValue(choice.scheme, light, dark);
  const number = index + 1;
  const title = step.title ?? screen.title;
  return {
    entry: screen,
    key: `step-${index}`,
    kind: choice.viewport,
    label: `${number} · ${title}`,
    row: 0,
    scheme: shown?.colorScheme ?? choice.scheme,
    selected: false,
    step: {
      description:
        step.description ?? (screen.details.description || undefined),
      index,
      lightOnly: choice.scheme === "dark" && !dark && light !== undefined,
      number,
      title,
    },
    view: shown,
    viewport: choice.viewport,
  };
}

/**
 * A use case's step frames, in step order, each in its own column of one
 * row. Each step of a current use case names a current screen; a step whose
 * screen is not in the catalogue has no frame.
 */
export function useCaseFrames(
  screens: readonly ShellCatalogueScreen[],
  useCase: Pick<CatalogueUseCase, "steps">,
  choice: UseCaseFramesChoice,
): UseCaseFramePlan[] {
  return useCase.steps
    .flatMap((step, index) => {
      const screen = screens.find(
        (candidate) => candidate.path === step.screenPath,
      );
      return screen ? [stepFrame(screen, step, index, choice)] : [];
    })
    .map((frame, column) => ({ ...frame, column }));
}
