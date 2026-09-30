/** Saved component variant selection and branch status. */

import { viewHref } from "../navigation/routes.js";

import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** Link sibling variant entries without creating a second route identity. */
export function WorkspaceVariantBar({
  data,
  variant,
}: {
  data: WorkspaceData;
  variant?: WorkspaceVariant;
}) {
  if (!data.component) return null;
  return (
    <nav aria-label="Saved variants" className="mbk-selection-bar">
      <span>Variant</span>
      {data.variants.map((candidate) => (
        <a
          aria-current={candidate === variant ? "page" : undefined}
          data-workspace-variant={candidate.value.id}
          href={`${viewHref("component", candidate.value.id)}${
            candidate.snapshotId ? `?snapshot=${candidate.snapshotId}` : ""
          }`}
          key={candidate.value.id}
        >
          {candidate.value.title}
          {candidate.removed ? " · Removed" : ""}
        </a>
      ))}
      <span
        className="mbk-variant-status"
        data-workspace-variant-status=""
        hidden={!variant?.status}
      >
        {variant?.status ? `${variant.value.title} · ${variant.status}` : null}
      </span>
    </nav>
  );
}
