/**
 * The Use case artboards of the Canvas viewer family: a use case as one
 * section of step frames, on Inspect and on its Changes tab.
 * `../../parts/destinations.ts` spreads them into `CANVAS_PAGES`, so Canvas
 * links reach them. Each key starts with `useCase`, so no key of another
 * state kind replaces one.
 */
export const FLOW_PAGES = {
  useCase: "design/canvas/flows/tour",
  useCaseChanges: "design/canvas/flows/tour/changes",
  useCaseMobile: "design/canvas/flows/tour/mobile",
  useCaseDark: "design/canvas/flows/tour/dark",
  useCaseSecondStep: "design/canvas/flows/tour/second-step",
} as const;

export type FlowDestination = (typeof FLOW_PAGES)[keyof typeof FLOW_PAGES];
