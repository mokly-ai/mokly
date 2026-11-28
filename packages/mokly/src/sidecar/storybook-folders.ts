import fs from "node:fs/promises";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { fileDigest, missingFile } from "./file-digests.js";
import { inside, logical } from "./path-scope.js";
import { PhysicalInputs } from "./physical-inputs.js";

const extensions = [
  "js",
  "ts",
  "jsx",
  "tsx",
  "mjs",
  "mts",
  "mtsx",
  "cjs",
  "cts",
  "ctsx",
];

/** The repository-relative folder of one compiled stories file. */
export function storybookFolder(params: BundleParams, story: string): string {
  return params.storybookFolders?.[story] ?? ".storybook";
}

/** One selection per folder, ordered independently of the story compile order. */
export function storybookFolders(params: BundleParams): string[] {
  return [
    ...new Set(
      params.storiesFiles.map((file) => storybookFolder(params, file)),
    ),
  ].sort();
}

/** Storybook's interpretation order for configuration and preview files. */
export function storybookCandidates(
  folder: string,
  name: "main" | "preview",
): string[] {
  return extensions.map((extension) =>
    path.posix.join(folder, `${name}.${extension}`),
  );
}

type Previews = NonNullable<CompiledGeneration["storybookPreviews"]>;

export interface PreviewProbe {
  selections: Previews;
  otherFiles: Map<string, string | null>;
  links: ReuseEvidence["inputs"];
}

/** Keep the lexical choice and the target used by every compile attempt. */
export async function probePreviews(
  params: BundleParams,
  capture?: PhysicalInputs,
): Promise<PreviewProbe> {
  const folders = storybookFolders(params);
  const physical =
    capture ?? (folders.length ? new PhysicalInputs() : undefined);
  const selections = new Map<string, Previews[string]>();
  const otherFiles = new Map<string, string | null>();
  for (const folder of folders) {
    const selection: Previews[string] = { selected: null, absent: [] };
    for (const name of storybookCandidates(folder, "preview")) {
      const candidate = path.resolve(params.sourceRoot, name);
      const captured = physical?.canonicalFile(candidate);
      const file = physical?.complete ? captured : await previewFile(candidate);
      if (file === undefined) {
        selection.absent.push(name);
      } else if (selection.selected === null) {
        selection.selected = {
          path: name,
          file: inside(params.sourceRoot, file)
            ? logical(params.sourceRoot, file)
            : file,
        };
      } else {
        otherFiles.set(name, await fileDigest(file));
      }
    }
    selections.set(folder, selection);
  }
  const links = Object.fromEntries(
    [...(physical?.inputs ?? [])].filter(([, input]) => input.kind === "link"),
  );
  return { selections: Object.fromEntries(selections), otherFiles, links };
}

export function previewModules(selections: Previews | undefined) {
  return Object.entries(selections ?? {}).flatMap(([folder, { selected }]) =>
    selected ? [[folder, selected.file] as const] : [],
  );
}

export async function recordPreviewInputs(
  root: string,
  probe: PreviewProbe,
  inputs: Record<string, string | null>,
  metadata: Record<string, string | null>,
): Promise<void> {
  for (const [name, digest] of probe.otherFiles)
    metadata[name] = inputs[path.resolve(root, name)] = digest;
  for (const { selected, absent } of Object.values(probe.selections)) {
    for (const name of absent)
      metadata[name] = inputs[path.resolve(root, name)] = null;
    if (!selected) continue;
    const file = path.resolve(root, selected.file);
    metadata[selected.path] = inputs[path.resolve(root, selected.path)] =
      inputs[file] ?? (await fileDigest(file));
  }
}

export async function previewsCurrent(
  root: string,
  selections: Previews,
): Promise<boolean> {
  for (const { selected, absent } of Object.values(selections)) {
    for (const name of absent)
      if (await regularFile(path.resolve(root, name))) return false;
    if (
      selected &&
      (await previewFile(path.resolve(root, selected.path))) !==
        path.resolve(root, selected.file)
    )
      return false;
  }
  return true;
}

async function previewFile(file: string): Promise<string | undefined> {
  try {
    const resolved = await fs.realpath(file);
    if (await regularFile(resolved)) return resolved;
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
}

export async function regularFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if (missingFile(error)) return false;
    throw error;
  }
}
