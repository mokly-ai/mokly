import path from "node:path";

import type { ReadStorybookResult } from "../generated/sidecar/ReadStorybookResult.js";

import { fileDigest } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { packageDirectories } from "./package-lookup.js";
import { inside, logical } from "./path-scope.js";
import type { PhysicalInputs } from "./physical-inputs.js";

export type StorybookInputs = Map<string, Set<string | null>>;

/** Capture the direct lookup's candidates before selecting a renderer. */
export async function directStorybookInputs(
  paths: ModulePaths,
  directory: string,
): Promise<StorybookInputs> {
  const inputs: StorybookInputs = new Map();
  for (const candidate of packageDirectories(
    paths,
    "@storybook/react",
    directory,
  )) {
    const file = path.join(candidate, "package.json");
    observeStorybookInput(inputs, file, await fileDigest(file));
  }
  return inputs;
}

export function observeStorybookInput(
  inputs: StorybookInputs,
  file: string,
  digest: string | null,
): void {
  const versions = inputs.get(file);
  if (versions) versions.add(digest);
  else inputs.set(file, new Set([digest]));
}

export function mergeStorybookInputs(
  inputs: StorybookInputs,
  added: StorybookInputs,
): void {
  for (const [file, versions] of added)
    for (const digest of versions) observeStorybookInput(inputs, file, digest);
}

export function storybookInputsAgree(
  reads: StorybookInputs | undefined,
): boolean {
  for (const versions of reads?.values() ?? [])
    if (versions.size > 1) return false;
  return true;
}

export function discoveryInputs(
  paths: ModulePaths,
  reads: StorybookInputs,
): Pick<ReadStorybookResult, "inputs" | "absentInputs"> {
  const inputs: ReadStorybookResult["inputs"] = [];
  const absentInputs: string[] = [];
  for (const [file, versions] of reads) {
    if (!paths.repositoryOwned(file)) continue;
    const path = logical(paths.sourceRoot, file);
    for (const digest of versions) {
      if (digest === null) absentInputs.push(path);
      else inputs.push({ kind: "whole-file", path, digest });
    }
  }
  return { inputs, absentInputs };
}

/** Keep the files read by the config loader in the physical and logical recipes. */
export function recordStorybookInputs(
  paths: ModulePaths,
  reads: StorybookInputs | undefined,
  physical: Record<string, string | null>,
  metadata: Record<string, string | null>,
  evidence?: PhysicalInputs,
): void {
  for (const [file, versions] of reads ?? []) {
    const digest = versions.values().next().value;
    if (digest === undefined) continue;
    physical[file] = digest;
    if (inside(paths.sourceRoot, file) || paths.dependencyDirectory(file))
      metadata[paths.metadataName(file)] = digest;
    if (evidence?.complete) {
      const input = evidence.file(file, true);
      if (
        !(digest === null
          ? input?.kind === "absent"
          : input?.kind === "file" && input.digest === digest)
      )
        evidence.complete = false;
    }
  }
}
