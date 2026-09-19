/** Saved component variant selection and branch status. */

import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** Keep variant routing controls independent of preview rendering. */
export function WorkspaceVariantBar({
  data,
  onSelect,
  variant,
}: {
  data: WorkspaceData;
  onSelect(value: string): void;
  variant?: WorkspaceVariant;
}) {
  if (data.entry.kind !== "component") return null;
  return (
    <div className="mbk-selection-bar">
      <label>
        Variant{" "}
        <select
          aria-label="Saved variant"
          data-workspace-variant=""
          onChange={(event) => onSelect(event.currentTarget.value)}
          value={variant?.value.id ?? ""}
        >
          {data.variants.map((candidate) => (
            <option key={candidate.value.id} value={candidate.value.id}>
              {candidate.value.title}
              {candidate.removed ? " · Removed" : ""}
            </option>
          ))}
        </select>
      </label>
      <span
        className="mbk-variant-status"
        data-workspace-variant-status=""
        hidden={!variant?.status}
      >
        {variant?.status ? `${variant.value.title} · ${variant.status}` : null}
      </span>
    </div>
  );
}
