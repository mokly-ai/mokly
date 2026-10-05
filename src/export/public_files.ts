import { GENERATED_DIRECTORY, isSafeRepositoryPath } from "@mokly/viewer/data";

import { generatedBytes, type GeneratedFile } from "../build/generated_file.js";
import { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { MANIFEST_NAME } from "../registry/manifest.js";

import { exportError } from "./error.js";
import { exportResourceDenial } from "./resource_policy.js";

/** Capture compiled documents and only their validated authored closure. */
export async function capturePublicFiles(
  config: ResolvedConfig,
  generated: ReadonlyMap<string, GeneratedFile>,
  closure: readonly string[],
): Promise<ReadonlyMap<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const denial = exportResourceDenial(config);
  const policy = new PublicFilePolicy(config);
  for (const name of closure) {
    if (
      !isSafeRepositoryPath(name) ||
      name.startsWith(`${GENERATED_DIRECTORY}/`)
    )
      throw exportError(`Invalid referenced asset: ${name}`);
    const reason = denial(name);
    if (reason)
      throw exportError(`Private export resource: ${name} (${reason})`);
    const content = policy.read(name);
    if (!content)
      throw exportError(
        `Referenced export resource is missing, private, non-regular or a symlink: ${name}`,
      );
    files.set(name, content);
  }
  for (const [name, content] of generated) {
    if (name === MANIFEST_NAME) continue;
    if (!isSafeRepositoryPath(name))
      throw exportError(`Invalid generated route: ${name}`);
    files.set(`${GENERATED_DIRECTORY}/${name}`, generatedBytes(content));
  }
  return new Map(
    [...files].sort(([left], [right]) => left.localeCompare(right)),
  );
}
