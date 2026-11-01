/**
 * The change status of a catalogue entry beside its title: Added, Changed,
 * Removed, or Unmodified, in the colour of its status.
 */

import type { DataAttribute } from "../segmented-control/segmented-control.js";

/** An entry's change status, which the badge shows as its word. */
export type ChangeStatusValue = "Added" | "Changed" | "Removed" | "Unmodified";

/**
 * The status badge. `data-status` carries the status for the stylesheet. A
 * badge without a status stays in place, hidden and empty, so that a host can
 * keep one badge while the status is not known yet.
 */
export function ChangeStatus({
  mark,
  status,
}: {
  /** An empty data attribute on the badge, such as `data-workspace-status`. */
  mark?: DataAttribute | undefined;
  status?: ChangeStatusValue | undefined;
}) {
  return (
    <span
      className="mbk-entry-status mbk-reset"
      data-status={status}
      {...(mark === undefined ? {} : { [mark]: "" })}
      hidden={status === undefined}
    >
      {status}
    </span>
  );
}
