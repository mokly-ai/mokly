import fs from "node:fs";
import path from "node:path";

import type { StaticDelivery, ReviewArtifactContent } from "@mokly/viewer/data";

import { timeAsync } from "../diagnostics/timings.js";

import { finalizeDeployment } from "./deployment.js";
import { assertExportActive } from "./error.js";
import { ExportInventory } from "./inventory.js";
import { EXPORT_MARKER } from "./ownership.js";
import { validateExportReferences } from "./references.js";

/** Validate, identify, and stage either a compiled site or a captured catalogue. */
export async function stageExport(
  stage: string,
  contents: ReadonlyMap<string, ReviewArtifactContent>,
  shells: ReadonlyMap<string, StaticDelivery>,
  aliases: ReadonlyMap<string, string>,
  signal?: AbortSignal,
  capture?: (
    files: ReadonlyMap<string, ReviewArtifactContent>,
  ) => Promise<void>,
): Promise<string> {
  const files = new ExportInventory();
  for (const [name, bytes] of contents) files.add(name, Buffer.from(bytes));
  files.add(
    EXPORT_MARKER,
    `${JSON.stringify({ schemaVersion: 1, files: [...files.files.keys()].sort() }, null, 2)}\n`,
  );
  validateExportReferences(files.files, aliases);
  const deploymentId = finalizeDeployment(files.files, shells, aliases);
  await timeAsync("review.write-artifact", async () => {
    for (const [name, bytes] of files.files) {
      assertExportActive(signal);
      const target = path.join(stage, name);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, bytes);
    }
  });
  await capture?.(files.files);
  return deploymentId;
}
