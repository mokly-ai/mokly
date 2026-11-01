import {
  ChangeStatus,
  type ChangeStatusValue,
} from "../../../../../../packages/ui/src/change-status/change-status.js";

import type { ChangeStatusProps } from "./change-status.js";

/** The shipped badge's word for each saved status. */
const STATUSES = {
  unmodified: "Unmodified",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
} as const satisfies Record<ChangeStatusProps["status"], ChangeStatusValue>;

/** The shipped change status badge, which shows the status as its word. */
export function ChangeStatusView({ status }: ChangeStatusProps) {
  return <ChangeStatus status={STATUSES[status]} />;
}
