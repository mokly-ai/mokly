/**
 * The Storybook stories artboards of the Canvas viewer family: a story that
 * could not render, on Inspect and on its Changes tab, and a stories entry's
 * link to the published Storybook, with the added story that has none.
 * `../../parts/destinations.ts` spreads them into `CANVAS_PAGES`, so Canvas
 * links reach them.
 */
export const STORY_PAGES = {
  storyFailed: "design/canvas/stories/failed",
  storyFailedChanges: "design/canvas/stories/failed/changes",
  storybookLink: "design/canvas/stories/storybook",
  storyAdded: "design/canvas/stories/storybook/added",
} as const;

export type StoryDestination = (typeof STORY_PAGES)[keyof typeof STORY_PAGES];
