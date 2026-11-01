/** Read the optional static deployment file without affecting browsing. */

import { record } from "../components/data.js";

import type { DeploymentFileV1 } from "./types.js";
import { hash } from "./values.js";

/** The only deployment file number this viewer reads. */
const DEPLOYMENT_FILE_VERSION = 1;

/** Read a deployment identity, or ignore a missing or unreadable file. */
export function readDeploymentFile(
  value: unknown,
): DeploymentFileV1 | undefined {
  if (!record(value) || value.schemaVersion !== DEPLOYMENT_FILE_VERSION)
    return undefined;
  try {
    return {
      schemaVersion: DEPLOYMENT_FILE_VERSION,
      deploymentId: hash(value.deploymentId),
    };
  } catch {
    return undefined;
  }
}
