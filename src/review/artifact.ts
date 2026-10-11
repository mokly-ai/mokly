/** Retain comparison JSON, snapshots, and a diagnostic summary. */

import { canonicalJson, parseReviewResult } from "@mokly/viewer/data";
import type {
  ReviewArtifact,
  ReviewArtifactContent,
  ReviewResult,
} from "@mokly/viewer/data";

import { addArtifactFile } from "./artifact_files.js";
import { validateArtifactResources } from "./artifact_resources.js";
import type { StylesheetReviewArtifact } from "./artifact_stylesheets.js";
import { markdownCode, markdownText } from "./markdown.js";
import { hasOutputChange } from "./materiality.js";

/** Add comparison metadata to isolated snapshot files. */
export function renderReviewArtifact(
  artifact: StylesheetReviewArtifact,
): ReadonlyMap<string, ReviewArtifactContent> {
  parseReviewResult(artifact.result);
  validateArtifactResources(artifact);
  const files = new Map(artifact.files);
  addArtifactFile(
    files,
    "review.json",
    `${canonicalJson(artifact.result, 2)}\n`,
  );
  addArtifactFile(
    files,
    "summary.md",
    summaryMarkdown(artifact.result, artifact.pairing),
  );
  addArtifactFile(
    files,
    ".mokly-review-artifact",
    `schemaVersion=${artifact.result.schemaVersion}\n`,
  );
  return files;
}

/** Create a concise deterministic CI summary. */
export function summaryMarkdown(
  result: ReviewResult,
  pairing?: ReviewArtifact["pairing"],
): string {
  const outputChanges = result.screens.filter(hasOutputChange).length;
  const counts = new Map<string, number>();
  const moved =
    pairing?.moves.length ??
    result.changes.filter((entry) => entry.previousPath !== undefined).length;
  for (const screen of result.screens)
    counts.set(screen.state, (counts.get(screen.state) ?? 0) + 1);
  const lines = [
    "## Mokly Review",
    "",
    `Base: ${markdownCode(result.baseRef)} (${markdownCode(result.baseCommit.slice(0, 12))})`,
    "",
    `Screens: ${result.screens.length}; output changes: ${outputChanges}; changed: ${counts.get("changed") ?? 0}; added: ${counts.get("added") ?? 0}; removed: ${counts.get("removed") ?? 0}; ignored-only: ${counts.get("ignored-only") ?? 0}.`,
    "",
    "Output changes count screens with changed documents or retained resource evidence, once per screen across all viewports and color schemes; catalogue Changes also considers metadata and flows.",
    "",
    `Changes: ${result.changes.length}; moved: ${moved}; components: ${result.components.length}; affected consumers: ${result.affectedConsumers.length}.`,
  ];
  if (result.changes.length > 0)
    lines.push(
      "",
      ...result.changes.map(
        (change) =>
          `- ${change.kind}: ${markdownText((change.after ?? change.before)!.title)} (${[...(change.previousPath ? ["moved"] : []), ...change.reasons.map((reason) => reason.kind)].join(", ")})`,
      ),
    );
  if (pairing?.diagnostics.length)
    lines.push(
      "",
      "Move diagnostics:",
      ...pairing.diagnostics.map(
        (diagnostic) => `- ${markdownText(diagnostic)}`,
      ),
    );
  return `${lines.join("\n")}\n`;
}
