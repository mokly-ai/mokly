import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type {
  HistoricalManifest,
  ManifestPage,
  ManifestV5,
} from "@mokly/viewer/data";

import { loadConfig } from "../../dist/config/load.js";
import type {
  BaselineReader,
  GitFile,
  GitFileKind,
} from "../../dist/review/git.js";

import { createFixture, removeFixture } from "./fixture.js";

export const PAGE_COMMIT = "b".repeat(40);
export const PAGE_ROUTE = "archive/guide.html";

interface BaselineFile {
  bytes?: Uint8Array;
  kind: GitFileKind;
}

export async function removedPagePreviewFixture(
  t: TestContext,
  schemaVersion: 4 | 5 = 4,
) {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const page: ManifestPage & { declaredDependencies: readonly string[] } = {
    declaredDependencies: [],
    dependencies: ["entries/guide.mockup.tsx"],
    description: "Historical guide",
    id: "guide",
    kind: "page",
    navPath: ["Archive"],
    relatedDocs: ["docs/guide.md"],
    route: PAGE_ROUTE,
    sourcePath: "entries/guide.mockup.tsx",
    tags: ["guide"],
    title: "Guide",
  };
  const baseline = {
    entries: [page],
    generatedBy: "mokly",
    schemaVersion,
    sourceFiles: ["entries/guide.mockup.tsx"],
  } as HistoricalManifest;
  const files = new Map<string, BaselineFile>();
  const add = (route: string, content: string | Uint8Array): void => {
    files.set(`mockups/${route}`, {
      bytes: typeof content === "string" ? Buffer.from(content) : content,
      kind: "regular",
    });
  };
  add(
    PAGE_ROUTE,
    '<!doctype html><link rel="stylesheet" href="../assets/main.css"><img src="../assets/direct.png"><iframe src="../assets/embed.html"></iframe><main>Baseline guide</main>',
  );
  add(
    "assets/main.css",
    '@import "./theme.css"; @font-face { src: url("./font.woff2"); } body { background: url("./background.png"); }',
  );
  add("assets/theme.css", '.guide { background: url("./nested.png"); }');
  add("assets/embed.html", '<img src="./embedded.png">');
  add("assets/direct.png", Uint8Array.from([0, 1, 2, 3]));
  add("assets/font.woff2", Uint8Array.from([4, 5, 6, 7]));
  add("assets/background.png", Uint8Array.from([8, 9]));
  add("assets/nested.png", Uint8Array.from([10, 11]));
  add("assets/embedded.png", Uint8Array.from([12, 13]));
  for (const [repoPath] of files) {
    const route = repoPath.slice("mockups/".length);
    const current = path.join(fixture.mockupsDir, route);
    await fs.mkdir(path.dirname(current), { recursive: true });
    await fs.writeFile(current, `current bytes for ${route}`);
  }
  const batches: string[][] = [];
  const reader = baselineReader(files, batches);
  const source = {
    baseline,
    baseCommit: PAGE_COMMIT,
    baseRef: "main",
    changedRoutes: [PAGE_ROUTE],
    removedEntries: [{ entry: page, ancestors: [] }],
    schemaVersion: 1 as const,
  };
  return { ...fixture, batches, baseline, config, files, page, reader, source };
}

export function baselineReader(
  files: ReadonlyMap<string, BaselineFile>,
  batches: string[][] = [],
): BaselineReader {
  const file = (route: string): BaselineFile =>
    files.get(route) ?? { kind: "missing" };
  return {
    fileExists: async (_commit, route) => file(route).kind !== "missing",
    fileKind: async (_commit, route) => file(route).kind,
    readFile: async (_commit, route) =>
      Buffer.from(file(route).bytes ?? []).toString(),
    readFileBytes: async (_commit, route) =>
      file(route).bytes ?? new Uint8Array(),
    readFiles: async (_commit, routes) => {
      batches.push([...routes]);
      return new Map<string, GitFile>(
        routes.map((route) => {
          const value = file(route);
          return [
            route,
            value.kind === "regular"
              ? { bytes: value.bytes ?? new Uint8Array(), kind: "regular" }
              : { kind: value.kind },
          ];
        }),
      );
    },
  };
}

export function v5Baseline(baseline: HistoricalManifest): ManifestV5 {
  if (!("sourceFiles" in baseline)) throw new Error("Expected source files");
  return { ...baseline, schemaVersion: 5 } as ManifestV5;
}
