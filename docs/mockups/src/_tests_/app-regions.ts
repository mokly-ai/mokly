/**
 * The part of a page a screen's own component draws. A screen answers for one
 * region; the frames around it — the settings dialog's bar, the account canvas
 * — belong to somebody else, so a label drawn there is not this screen's to
 * match. Every region but one is the last on its page that holds a control, so
 * reading from its marker to the end of the document reads exactly it.
 *
 * `bar` is the exception, and the reason it is bounded below. The viewer's slot
 * bar is the *first* region on its page, so a marker-to-end read would sweep
 * the stage in with it; a page whose whole subject is the bar reads from the
 * bar's marker to the stage's instead. Those pages exist because the cloud
 * fills the bar's slots: what it calls a reader who has set no name, and the
 * offer it makes when a newer publication arrives, are drawings with nowhere
 * else to live.
 */
export const regions = {
  bar: "fo-top-bar",
  stage: "fo-stage-canvas",
  panel: "fo-viewer-panel-body",
  pane: "fo-dialog-body",
  panelled: "fo-account-content",
  recovery: "fo-recovery-body",
} as const;

/** Where a region stops, for the one region that is not the last on its page. */
export const regionEnds: Partial<Record<keyof typeof regions, string>> = {
  bar: "fo-stage-canvas",
};

/**
 * What every pane delegates: the retry a failed load offers, and the label a
 * control reads while its own write is working or refused. A pane names its
 * operation; these name the recovery, so both belong to every pane's answer.
 */
export const shared = ["components/resource-state.tsx", "settings/write.ts"];

/** One screen's answer: who draws it, or the path whose arrival will. */
export type Owner = { region: keyof typeof regions } & (
  | { files: readonly string[]; pending?: undefined }
  | { pending: string; files?: undefined }
);
