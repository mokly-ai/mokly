/**
 * Saved component variant selection and branch status. This container builds
 * each variant's link; `@mokly/ui/variant-bar` draws the bar.
 */

import { VariantBar } from "@mokly/ui/variant-bar";

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
    <VariantBar
      status={
        variant?.status
          ? `${variant.value.title} · ${variant.status}`
          : undefined
      }
      variants={data.variants.map((candidate) => ({
        current: candidate === variant,
        href: `${viewHref(candidate.value.path)}${
          candidate.snapshotId ? `?snapshot=${candidate.snapshotId}` : ""
        }`,
        path: candidate.value.path,
        removed: candidate.removed === true,
        title: candidate.value.title,
      }))}
    />
  );
}
