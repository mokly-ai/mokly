import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Compilation } from "../../dist/build/compile.js";
import {
  generatedBytes,
  generatedText,
  type GeneratedFile,
} from "../../dist/build/generated_file.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";
import type {
  ManifestScreen,
  ManifestV5,
} from "../../packages/viewer/dist/registry/types.js";

import { textOutput } from "./generated_text.js";

const execFileAsync = promisify(execFile);

export async function git(
  cwd: string,
  arguments_: readonly string[],
): Promise<void> {
  await execFileAsync("git", [...arguments_], { cwd });
}

export function fakeGit(
  files: ReadonlyMap<string, GeneratedFile>,
): ReadOnlyReviewRepository {
  return {
    evidence: {
      changedPaths: async () => [],
      mergeBase: async () => "a".repeat(40),
    },
    reader: {
      fileExists: async (_commit, repoPath) => files.has(repoPath),
      fileKind: async (_commit, repoPath) =>
        files.has(repoPath) ? "regular" : "missing",
      readFile: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return generatedText(content, repoPath)!;
      },
      readFileBytes: async (_commit, repoPath) => {
        const content = files.get(repoPath);
        if (content === undefined)
          throw new Error(`missing fake Git path ${repoPath}`);
        return generatedBytes(content);
      },
    },
  };
}

export function filesForCompilation(
  manifest: ManifestV5,
  compilation: Compilation,
): Map<string, GeneratedFile> {
  const files = new Map<string, GeneratedFile>([
    ["mockups/mokly-manifest.json", `${JSON.stringify(manifest)}\n`],
  ]);
  for (const [route, content] of compilation.outputs) {
    if (route === "mokly-manifest.json") continue;
    files.set(`mockups/${route}`, content);
  }
  return files;
}

export function withoutDarkFragments(manifest: ManifestV5): ManifestV5 {
  return {
    ...manifest,
    entries: manifest.entries.map((entry) => {
      if (entry.kind !== "screen") return entry;
      const { darkFragments: _darkFragments, ...screen } = entry;
      return screen;
    }),
  };
}

export function withHomeIgnoredRegions(
  compilation: Compilation,
  label: string,
  ids: readonly string[] = ["nav"],
): Compilation {
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "home",
  );
  if (home?.kind !== "screen") throw new Error("missing home screen");
  const outputs = new Map(compilation.outputs);
  for (const fragment of screenFragments(home)) {
    const content = outputs.get(fragment);
    if (content === undefined) throw new Error(`missing output ${fragment}`);
    outputs.set(
      fragment,
      insertIgnoredRegions(textOutput(outputs, fragment)!, label, ids),
    );
  }
  return { ...compilation, outputs };
}

function screenFragments(screen: ManifestScreen): string[] {
  return [
    ...Object.values(screen.fragments),
    ...Object.values(screen.darkFragments ?? {}),
  ];
}

function insertIgnoredRegions(
  content: string,
  label: string,
  ids: readonly string[],
): string {
  const regions = ids
    .map(
      (id) =>
        `<!--mokly-review-ignore:start:${id}-->` +
        `<span>${label}-${id}</span>` +
        `<!--mokly-review-ignore:end:${id}-->`,
    )
    .join("");
  if (!content.includes("</main>")) throw new Error("missing main close tag");
  return content.replace("</main>", `${regions}</main>`);
}
