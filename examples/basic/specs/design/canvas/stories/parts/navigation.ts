import type { NavigationState } from "../../../parts/navigation_states.js";

import { STORY_PAGES as S, type StoryDestination } from "./destinations.js";

/** A variant set fits at full size, so Fit keeps its state, selection and all. */
const fitted = (
  fit: StoryDestination,
  canvas: NonNullable<NavigationState["canvas"]> = {},
): NavigationState => ({ canvas: { ...canvas, fit } });

/**
 * The authored transitions of the Storybook stories artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * The failed Expanded story moves between Inspect and its Changes tab. The
 * Menu's own page is unmodified, but its set shows the changed Expanded row,
 * so it has a Changes tab too. No artboard shows the Menu's Changes tab or
 * the added Disabled story's, so those tabs are pictures. A phone shows each
 * Inspect state with its sheet open, so the dock's Inspect opens the same
 * artboard. No artboard shows that sheet closed, so its close is a picture.
 */
export const STORY_NAVIGATION_STATES = {
  [S.storyFailed]: fitted(S.storyFailed, {
    changesTab: S.storyFailedChanges,
    panelSheet: S.storyFailed,
  }),
  [S.storyFailedChanges]: fitted(S.storyFailedChanges, {
    inspectTab: S.storyFailed,
  }),
  [S.storybookLink]: fitted(S.storybookLink, {
    panelSheet: S.storybookLink,
  }),
  [S.storyAdded]: fitted(S.storyAdded, { panelSheet: S.storyAdded }),
} satisfies Record<StoryDestination, NavigationState>;
