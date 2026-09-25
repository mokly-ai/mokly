/** Evidence-only workspace updates preserve loaded usage and local edit state. */

import type { WorkspaceData } from "./workspace_data.js";

/** Merge a newer evidence snapshot into the current route workspace. */
export function mergeWorkspaceEvidence(
  current: WorkspaceData,
  next: WorkspaceData,
): void {
  const views = current.views;
  const generation = current.previewGeneration;
  for (const key of [
    "status",
    "change",
    "comparison",
    "resourceEvidence",
    "usageComplete",
    "viewUsagePending",
    "previewGeneration",
    "renderCapability",
  ] as const)
    delete current[key];
  Object.assign(current, next);
  if (generation && generation === next.previewGeneration) {
    current.views = next.views.map((view) => {
      const retained = views.find(
        (previous) => previous.path === view.path,
      )?.usage;
      const merged = { ...view };
      delete merged.usage;
      return retained ? { ...merged, usage: retained } : merged;
    });
  }
}
