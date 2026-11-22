/**
 * The Props and controls artboards of the Canvas viewer family: the edit
 * states of Inspect's Props section. `../../parts/destinations.ts` spreads
 * them into `CANVAS_PAGES`, so Canvas links reach them.
 */
export const PROPS_PAGES = {
  propsEditing: "design/canvas/props/editing",
  propsEdited: "design/canvas/props/editing/edited",
  propsUnset: "design/canvas/props/editing/unset",
  propsReset: "design/canvas/props/editing/reset",
  propsPending: "design/canvas/props/states",
  propsInvalid: "design/canvas/props/states/invalid",
  propsInvalidTogether: "design/canvas/props/states/invalid-together",
  propsError: "design/canvas/props/states/error",
  propsExpired: "design/canvas/props/states/expired",
  propsPreparing: "design/canvas/props/preparing",
  propsPreparingFailed: "design/canvas/props/preparing/failed",
  propsPublished: "design/canvas/props/read-only",
  propsPublishedDisabled: "design/canvas/props/read-only/disabled",
  propsNoProps: "design/canvas/props/read-only/no-props",
  propsLoading: "design/canvas/props/loading",
  propsLoadingFailed: "design/canvas/props/loading/failed",
} as const;

export type PropsDestination = (typeof PROPS_PAGES)[keyof typeof PROPS_PAGES];
