import fs from "node:fs/promises";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { missingFile } from "./file-digests.js";

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

/** Include absent candidates so that a new file can invalidate a bundle. */
export function previewCandidates(params: BundleParams): string[] {
  return storybookFolders(params).flatMap((folder) =>
    storybookCandidates(folder, "preview"),
  );
}

export function selectPreviews(
  params: BundleParams,
  present: (file: string) => boolean,
): Map<string, string> {
  const previews = new Map<string, string>();
  for (const folder of storybookFolders(params)) {
    const file = storybookCandidates(folder, "preview").find(present);
    if (file !== undefined) previews.set(folder, file);
  }
  return previews;
}

export async function regularFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if (missingFile(error)) return false;
    throw error;
  }
}
