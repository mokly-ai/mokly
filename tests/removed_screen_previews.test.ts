import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  generatedViews,
  viewRoute,
  type ManifestScreen,
  type ManifestV8,
  type ReviewResultV5,
} from "@mokly/viewer/data";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  generatedBytes,
  transferGeneratedFile,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import { compareReview } from "../dist/review/compare.js";
import type { BaselineReader, GitFile } from "../dist/review/git.js";
import { RepositorySelectedReview } from "../dist/review/selected.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

const commit = "a".repeat(40);

for (const mode of ["committed", "derived"] as const) {
  test(`removed screen selected capture retains every historical view in ${mode} mode`, async (t) => {
    const fixture = await screenFixture(t);
    const source = {
      after: fixture.current.manifest,
      before: fixture.baseline,
      baseCommit: commit,
      baseRef: "main",
      changedPaths: [],
      headDigests: {},
      result: removedScreenResult(fixture.screen),
      ...(mode === "derived"
        ? {
            headOutputs: [...fixture.current.outputs].map(
              ([route, content]) =>
                [route, transferGeneratedFile(content)] as const,
            ),
          }
        : {}),
    };
    const artifact = await new RepositorySelectedReview(
      { ...fixture.config, generatedOutput: mode },
      fixture.reader,
    ).generate(
      source,
      { path: fixture.screen.path },
      new AbortController().signal,
    );

    assert.equal(artifact.result.schemaVersion, 5);
    const screen = artifact.result.screens[0]!;
    assert.equal(screen.state, "removed");
    assert.equal(screen.views.length, 4);
    for (const view of screen.views) {
      assert.equal(view.state, "removed");
      const snapshot = `snapshots/before/${viewRoute(screen.path, view.viewport, view.colorScheme)}`;
      assert.match(String(artifact.files.get(snapshot)), /baseline view/);
    }
    assert.equal(
      String(artifact.files.get("snapshots/before/assets/removed.css")),
      "body { color: baseline; }",
    );
  });

  test(`component-aware removed screen stays before-only in ${mode} mode`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) =>
      source.replace(/ {2}defineScreen\([^\n]+\)\n/, ""),
    );
    const complete = await compareReview(
      fixture.after,
      { ...fixture.config, generatedOutput: mode },
      fixture.git,
      "main",
    );
    assert.equal(complete.result.schemaVersion, 5);
    const selected = await new RepositorySelectedReview(
      { ...fixture.config, generatedOutput: mode },
      fixture.git.reader,
    ).generate(
      {
        after: fixture.after.manifest,
        before: fixture.before.manifest,
        baseCommit: commit,
        baseRef: "main",
        changedPaths: fixture.changedPaths,
        headDigests: digestOutputs(fixture.after.outputs),
        ...(mode === "derived"
          ? {
              headOutputs: [...fixture.after.outputs].map(
                ([route, content]) =>
                  [route, transferGeneratedFile(content)] as const,
              ),
            }
          : {}),
        result: complete.result,
      },
      { path: "home" },
      new AbortController().signal,
    );

    assert.equal(selected.result.schemaVersion, 5);
    const screen = selected.result.screens[0]!;
    assert.equal(screen.state, "removed");
    assert.ok(screen.views.length > 0);
    assert.ok(screen.views.every((view) => view.state === "removed"));
    for (const view of screen.views)
      assert.deepEqual(
        Buffer.from(
          selected.files.get(
            `snapshots/before/${viewRoute(screen.path, view.viewport, view.colorScheme)}`,
          )!,
        ),
        Buffer.from(
          textOutput(
            fixture.before.outputs,
            viewRoute(screen.path, view.viewport, view.colorScheme),
          )!,
        ),
      );
  });
}

test("removed screen capture never substitutes current files for deleted history", async (t) => {
  const fixture = await screenFixture(t);
  fixture.files.delete("mockups/assets/removed.css");

  await assert.rejects(
    new RepositorySelectedReview(fixture.config, fixture.reader).generate(
      selectedSource(fixture),
      { path: fixture.screen.path },
      new AbortController().signal,
    ),
    /Snapshot file is missing: assets\/removed\.css/,
  );
});

test("removed screen capture fails when a historical view is missing", async (t) => {
  const fixture = await screenFixture(t);
  fixture.files.delete("mockups/removed/index.desktop.dark.html");

  await assert.rejects(
    new RepositorySelectedReview(fixture.config, fixture.reader).generate(
      selectedSource(fixture),
      { path: fixture.screen.path },
      new AbortController().signal,
    ),
    /Snapshot file is missing: removed\/index\.desktop\.dark\.html/,
  );
});

async function screenFixture(t: test.TestContext) {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const current = await compileCatalogue(config);
  const currentHome = current.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.path === "home",
  );
  assert.ok(currentHome?.kind === "screen");
  const screen: ManifestScreen = {
    ...currentHome,
    path: "removed",
    title: "Removed",
    useCasePaths: [],
  };
  const storedBaseline: ManifestV8 = {
    entries: [
      {
        ...screen,
      },
    ],
    generatedBy: "mokly",
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: current.manifest.sourceFiles,
  };
  const files = new Map<string, Uint8Array>([
    [
      "mockups/mokly-manifest.json",
      Buffer.from(JSON.stringify(storedBaseline)),
    ],
    ["mockups/assets/removed.css", Buffer.from("body { color: baseline; }")],
  ]);
  for (const route of generatedViews(screen).map((view) => view.path))
    files.set(
      `mockups/${route}`,
      Buffer.from(
        '<!doctype html><link rel="stylesheet" href="../assets/removed.css"><main>baseline view</main>',
      ),
    );
  await fs.mkdir(path.join(fixture.mockupsDir, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "assets/removed.css"),
    "body { color: current; }",
  );
  const reader = baselineReader(files);
  const baseline = parseHistoricalManifest(storedBaseline);
  return { ...fixture, baseline, config, current, files, reader, screen };
}

function selectedSource(fixture: Awaited<ReturnType<typeof screenFixture>>) {
  return {
    after: fixture.current.manifest,
    before: fixture.baseline,
    baseCommit: commit,
    baseRef: "main",
    changedPaths: [],
    headDigests: {},
    result: removedScreenResult(fixture.screen),
  };
}

function removedScreenResult(screen: ManifestScreen): ReviewResultV5 {
  return {
    affectedConsumers: [],
    baseCommit: commit,
    baseRef: "main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [
      {
        before: { path: screen.path, title: screen.title },
        path: screen.path,
        state: "removed",
        title: screen.title,
        views: generatedViews(screen).map((view) => ({
          colorScheme: view.colorScheme,
          ignoredIds: [],
          state: "removed",
          viewport: view.viewport,
        })),
      },
    ],
  };
}

function baselineReader(
  files: ReadonlyMap<string, Uint8Array>,
): BaselineReader {
  return {
    fileExists: async (_commit, route) => files.has(route),
    fileKind: async (_commit, route) =>
      files.has(route) ? "regular" : "missing",
    readFile: async (_commit, route) =>
      Buffer.from(files.get(route)!).toString(),
    readFileBytes: async (_commit, route) => files.get(route)!,
    readFiles: async (_commit, routes) =>
      new Map<string, GitFile>(
        routes.map((route) => [
          route,
          files.has(route)
            ? { kind: "regular", bytes: files.get(route)! }
            : { kind: "missing" },
        ]),
      ),
  };
}

function digestOutputs(
  outputs: ReadonlyMap<string, GeneratedFile>,
): Record<string, string> {
  return Object.fromEntries(
    [...outputs].map(([route, content]) => [
      route,
      createHash("sha256").update(generatedBytes(content)).digest("hex"),
    ]),
  );
}
