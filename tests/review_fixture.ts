import { baselineCatalogue } from "../dist/baseline/catalogue.js";
import type { Compilation } from "../dist/build/compile.js";
import {
  generatedBytes,
  generatedText,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import { generatedViews } from "../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV9,
} from "../packages/viewer/dist/registry/types.js";

import { entryAt } from "./helpers/catalogue_selection.js";
import { textOutput } from "./helpers/generated_text.js";

export function fakeGit(
  files: ReadonlyMap<string, GeneratedFile>,
): ReadOnlyReviewRepository {
  const commit = "a".repeat(40);
  const descriptor = baselineCatalogue(commit, "mockups");
  return {
    evidence: {
      changedPaths: async () => [],
      mergeBase: async () => commit,
    },
    reader: {
      ...(descriptor ? { catalogue: descriptor } : {}),
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
    ...(descriptor ? { descriptor } : {}),
  };
}

export function filesForCompilation(
  manifest: ManifestV9,
  compilation: Compilation,
): Map<string, GeneratedFile> {
  const files = new Map<string, GeneratedFile>([
    [
      "mockups/mokly-generated/mokly-manifest.json",
      `${JSON.stringify(manifest)}\n`,
    ],
  ]);
  for (const [route, content] of compilation.outputs) {
    if (route === "mokly-manifest.json") continue;
    files.set(`mockups/mokly-generated/${route}`, content);
  }
  return files;
}

export function withoutDarkFragments(manifest: ManifestV9): ManifestV9 {
  return {
    ...manifest,
    generatedFiles: manifest.generatedFiles.filter(
      (file) => !file.path.endsWith(".dark.html"),
    ),
    entries: manifest.entries.map((entry) => {
      if (entry.kind !== "screen") return entry;
      return {
        ...entry,
        colorSchemes: ["light"],
        ...(entry.componentViews
          ? {
              componentViews: entry.componentViews.filter(
                (view) => view.colorScheme === "light",
              ),
            }
          : {}),
      };
    }),
  };
}

export function withHomeIgnoredRegions(
  compilation: Compilation,
  label: string,
  ids: readonly string[] = ["nav"],
): Compilation {
  const home = entryAt(compilation.manifest, "home", "screen");
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

export function screenFragments(screen: ManifestScreen): string[] {
  return generatedViews(screen).map((view) => view.path);
}

export function insertIgnoredRegions(
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
