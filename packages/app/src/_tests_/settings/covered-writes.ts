/**
 * The undoable writes that one walk of `writes.spec.ts` leaves out, each with
 * the test that covers it. A row leaves a walk only when the named test fails
 * on a break of each part of that control's own wiring that the walk reads,
 * and never as the last row of its pane or screen in that walk. A write that a
 * walk does not name here runs in it.
 */
export type Walk = "busy" | "undo" | "refusal";

export const coveredElsewhere: Readonly<
  Record<Walk, Readonly<Record<string, string>>>
> = {
  busy: {},
  undo: {
    "members/save-role":
      "settings/members.spec.ts: a failed role change stays on the role form",
    "members/confirm-remove-member":
      "settings/members.spec.ts: a failed removal leaves no way back on the role form",
    "project/confirm-visibility":
      "settings/project-panes.spec.ts: visibility changes behind a confirmation and offers the way back",
  },
  refusal: {
    "members/confirm-remove-member":
      "settings/members.spec.ts: a failed removal leaves no way back on the role form",
    "tokens/confirm-revoke":
      "settings/tokens.spec.ts: a failed token revoke says so and offers one retry",
  },
};

/** Whether `walk` runs the write at `where`. */
export function walks(walk: Walk) {
  return (write: { where: string }): boolean =>
    !(write.where in coveredElsewhere[walk]);
}
