import { useDesignStyle } from "../style_context.js";

import type { ChangeStatusProps } from "./change-status.js";

const labels = {
  unmodified: "Unmodified",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
} as const;
export function ChangeStatusView({ status }: ChangeStatusProps) {
  useDesignStyle("change-status");
  return (
    <span
      className={`ce-change-status ce-${status}`}
      data-change-status={status}
    >
      {labels[status]}
    </span>
  );
}
