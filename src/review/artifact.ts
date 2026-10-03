/** Retain comparison JSON, snapshots, and a diagnostic summary. */

import { canonicalJson, parseReviewResult } from "@mokly/viewer/data";
import type {
  ReviewArtifact,
  ReviewArtifactContent,
  ReviewResult,
} from "@mokly/viewer/data";

import { addArtifactFile } from "./artifact_files.js";
import { validateArtifactResources } from "./artifact_resources.js";
import { markdownCode, markdownText } from "./markdown.js";
import { hasOutputChange, isImpactOnly } from "./materiality.js";

/** Add comparison metadata to isolated snapshot files. */
export function renderReviewArtifact(
  artifact: ReviewArtifact,
): ReadonlyMap<string, ReviewArtifactContent> {
  parseReviewResult(artifact.result);
  validateArtifactResources(artifact);
  const files = new Map(artifact.files);
  addArtifactFile(
    files,
    "review.json",
    `${canonicalJson(artifact.result, 2)}\n`,
  );
  addArtifactFile(files, "summary.md", summaryMarkdown(artifact.result));
  addArtifactFile(
    files,
    ".mokly-review-artifact",
    `schemaVersion=${artifact.result.schemaVersion}\n`,
  );
  return files;
}

/** Create a concise deterministic CI summary. */
export function summaryMarkdown(result: ReviewResult): string {
  const outputChanges = result.screens.filter(hasOutputChange).length;
  const impactEvidence = result.screens.filter(
    (screen) => screen.sharedImpact.length > 0,
  ).length;
  const impactOnly = result.screens.filter(isImpactOnly).length;
  const counts = new Map<string, number>();
  for (const screen of result.screens)
    counts.set(screen.state, (counts.get(screen.state) ?? 0) + 1);
  const lines = [
    "## Mokly Review",
    "",
    `Base: ${markdownCode(result.baseRef)} (${markdownCode(result.baseCommit.slice(0, 12))})`,
    "",
    `Screens: ${result.screens.length}; output changes: ${outputChanges}; changed: ${counts.get("changed") ?? 0}; added: ${counts.get("added") ?? 0}; removed: ${counts.get("removed") ?? 0}; ignored-only: ${counts.get("ignored-only") ?? 0}; impact evidence: ${impactEvidence}; impact-only: ${impactOnly}.`,
    "",
    "Output changes count screens with changed documents or retained resource evidence, once per screen across all viewports and color schemes; catalogue Changes also considers metadata and flows. Impact evidence is counted independently; impact-only screens have no output change and can also be ignored-only.",
    "",
    `Changes: ${result.changes.length}; components: ${result.components.length}; affected consumers: ${result.affectedConsumers.length}.`,
  ];
  if (result.changes.length > 0)
    lines.push(
      "",
      ...result.changes.map(
        (change) =>
          `- ${change.kind}: ${markdownText((change.after ?? change.before)!.title)} (${change.reasons.map((reason) => reason.kind).join(", ")})`,
      ),
    );
  if (result.sharedImpact.length > 0)
    lines.push(
      "",
      "Shared-impact paths:",
      ...result.sharedImpact.map((item) => `- ${markdownCode(item)}`),
    );
  return `${lines.join("\n")}\n`;
}
