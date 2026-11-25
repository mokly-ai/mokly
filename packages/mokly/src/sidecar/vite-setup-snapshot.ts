import { createHash } from "node:crypto";
import path from "node:path";

import type { ModulePaths } from "./module-paths.js";
import { logical } from "./path-scope.js";
import { directoryFiles } from "./resolution-inputs.js";
import { INSTALLED_INPUT_PREFIX } from "./source-dependencies.js";
import { configPresent, viteConfigFiles } from "./vite-config.js";
import type { VitePostcssLookup } from "./vite-postcss-lookup.js";
import { setupCandidate, setupChanged } from "./vite-setup-input.js";
import type { ConfigReads, SetupInput } from "./vite-setup-input.js";
import type { ViteSetup } from "./vite-setup.js";
import type { ViteEnv } from "./vite-working-env.js";

export interface SetupFiles {
  configuration: ConfigReads;
  envFiles: string[];
  env: ViteEnv;
  rebuild: string[];
  postcss: VitePostcssLookup;
}

/** Snapshot setup bytes and config lookup membership before reusing a server. */
export async function setupSnapshot(
  files: SetupFiles,
  directory: string,
  paths: ModulePaths,
) {
  const configuration = await confinedInputs(
    [
      ...viteConfigFiles.map((file) => path.join(directory, file)),
      ...files.configuration.files.keys(),
    ],
    paths,
  );
  const probes = new Map(
    await Promise.all(
      [...files.configuration.probes.keys()].map(
        async (file) => [file, await configPresent(file)] as const,
      ),
    ),
  );
  return setupEvidence(
    configuration,
    probes,
    await files.env.snapshot(files.envFiles),
    await files.postcss.snapshot(),
    await rebuildInputs(files.rebuild, paths),
    await directoryFiles(directory),
  );
}

export function setupEvidence(
  configuration: Map<string, SetupInput>,
  probes: Map<string, boolean>,
  env: Awaited<ReturnType<ViteEnv["snapshot"]>>,
  postcss: SetupInput[],
  rebuild: SetupInput[],
  entries: string[],
) {
  const inputs = [...configuration.values(), ...postcss, ...rebuild];
  const envInputs = [...env.values()];
  const stamp = JSON.stringify([inputs, envInputs, entries, [...probes]]);
  const canonical = new Map<string, Set<string | null>>();
  for (const { name, digest } of [
    ...inputs,
    ...envInputs.filter((input) => input.render),
  ]) {
    const logical = name.startsWith(INSTALLED_INPUT_PREFIX)
      ? name.slice(INSTALLED_INPUT_PREFIX.length)
      : name;
    const versions = canonical.get(logical) ?? new Set<string | null>();
    versions.add(digest);
    canonical.set(logical, versions);
  }
  const pairs = [...canonical].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        pairs.map(([name, versions]) => [name, [...versions].sort()]),
      ),
    )
    .digest("hex");
  return {
    stamp,
    inputs,
    configuration,
    probes,
    env,
    envInputs,
    postcss,
    rebuild,
    entries,
    digest,
  };
}

export type SetupSnapshot = ReturnType<typeof setupEvidence>;
export function rebuildInputs(files: string[], paths: ModulePaths) {
  return Promise.all(
    files.map(async (name) =>
      setupCandidate(
        name,
        await paths.metadata(path.resolve(paths.sourceRoot, name)),
      ),
    ),
  );
}

async function confinedInputs(files: string[], paths: ModulePaths) {
  return new Map(
    await Promise.all(
      [...new Set(files)].map(async (file) => {
        const physical = await paths.metadata(file);
        return [
          file,
          await setupCandidate(paths.metadataName(physical), physical),
        ] as const;
      }),
    ),
  );
}

export function verifyInputs(
  previous: readonly SetupInput[],
  current: readonly SetupInput[],
): void {
  const now = new Map(current.map((input) => [input.name, input]));
  for (const { name, file, digest } of previous) {
    const input = now.get(name);
    if (!input || input.file !== file || input.digest !== digest)
      setupChanged(name);
  }
}

export function verifyConfigReads(
  reads: ConfigReads,
  state: SetupSnapshot,
  paths: ModulePaths,
): void {
  for (const [file, present] of reads.probes)
    if (state.probes.get(file) !== present)
      setupChanged(logical(paths.sourceRoot, file));
  for (const [file, digests] of reads.files) {
    const input = state.configuration.get(file);
    for (const digest of digests)
      if (input?.digest !== digest)
        setupChanged(input?.name ?? logical(paths.sourceRoot, file));
  }
}

export async function verifySetup(
  setup: ViteSetup,
  directory: string,
  paths: ModulePaths,
): Promise<void> {
  const current = await setupSnapshot(setup.files, directory, paths);
  const prior = setup.state;
  if (prior.stamp === current.stamp) return;
  for (const [file, present] of prior.probes)
    if (current.probes.get(file) !== present)
      setupChanged(logical(paths.sourceRoot, file));
  verifyInputs(
    [...prior.configuration.values()],
    [...current.configuration.values()],
  );
  for (const [file, input] of prior.env) {
    const checked = current.env.get(file);
    if (
      checked?.file !== input.file ||
      checked.digest !== input.digest ||
      checked.working !== input.working
    )
      setupChanged(input.name);
  }
  verifyInputs(prior.postcss, current.postcss);
  verifyInputs(prior.rebuild, current.rebuild);
  const changed =
    prior.entries.find((entry) => !current.entries.includes(entry)) ??
    current.entries.find((entry) => !prior.entries.includes(entry));
  setupChanged(
    logical(
      paths.sourceRoot,
      changed ? path.join(directory, changed) : directory,
    ),
  );
}
