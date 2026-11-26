/**
 * The undoable writes that one walk of `writes.spec.ts` leaves out, because a
 * named test of that control already fails when its own wiring for the walk
 * breaks. Each pane or screen keeps at least one row in every walk, so the
 * shared write code is still read wherever a refusal is drawn. A write that
 * a walk does not name here runs in it.
 */
export type Walk = "busy" | "undo" | "refusal";

export const coveredElsewhere: Readonly<
  Record<Walk, Readonly<Record<string, string>>>
> = {
  busy: {
    "tokens/confirm-revoke":
      "settings/tokens.spec.ts: pressing a destructive control twice sends one write",
    "members/save-role":
      "settings/members.spec.ts: a failed role change stays on the role form",
  },
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
    "project/confirm-visibility":
      "plan.spec.ts: making a project private on the free plan is refused in its modal",
    "tokens/confirm-revoke":
      "settings/tokens.spec.ts: a failed token revoke says so and offers one retry",
  },
};

/** Whether `walk` runs the write at `where`. */
export function walks(walk: Walk) {
  return (write: { where: string }): boolean =>
    !(write.where in coveredElsewhere[walk]);
}
