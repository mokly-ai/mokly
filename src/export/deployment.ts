import { readCatalogue } from "@mokly/viewer";
import { canonicalJson } from "@mokly/viewer/data";
import type { StaticDelivery, ReviewArtifactContent } from "@mokly/viewer/data";

import { CATALOGUE_PATH } from "../catalogue/serialization.js";

import { deploymentContentId } from "./content_id.js";
import { exportError } from "./error.js";
import {
  readExportShellMetadata,
  stampExportShell,
  STAGED_DEPLOYMENT_ID,
  type ExportShellMetadata,
} from "./shell_metadata.js";

/** Hash the complete final artifact, then stamp only its authenticated shell roots. */
export function finalizeDeployment(
  files: Map<string, ReviewArtifactContent>,
  shells: ReadonlyMap<string, StaticDelivery>,
  aliases: ReadonlyMap<string, string>,
): string {
  const catalogueBytes = files.get(CATALOGUE_PATH);
  if (catalogueBytes === undefined)
    throw exportError("Missing owned public catalogue.");
  const catalogue: Record<string, unknown> = JSON.parse(
    Buffer.from(catalogueBytes).toString("utf8"),
  );
  readCatalogue(catalogue);
  catalogue.deploymentId = STAGED_DEPLOYMENT_ID;
  files.set(CATALOGUE_PATH, `${canonicalJson(catalogue, 2)}\n`);
  const metadata = new Map<string, ExportShellMetadata>();
  for (const [name, expected] of shells) {
    const bytes = files.get(name);
    if (bytes === undefined)
      throw exportError(`Missing static shell metadata document: ${name}`);
    const shell = readExportShellMetadata(
      name,
      Buffer.from(bytes).toString("utf8"),
      expected,
    );
    metadata.set(name, shell);
    files.set(name, stampExportShell(shell, STAGED_DEPLOYMENT_ID));
  }
  const deploymentId = deploymentContentId(files, aliases);
  for (const [name, shell] of metadata)
    files.set(name, stampExportShell(shell, deploymentId));
  catalogue.deploymentId = deploymentId;
  files.set(CATALOGUE_PATH, `${canonicalJson(catalogue, 2)}\n`);
  return deploymentId;
}
