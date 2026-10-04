import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readManifest } from "../dist/registry/manifest.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { asChangeEvidence } from "../dist/review/change_evidence.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import {
  CommittedRepository,
  NodeGitCommandRunner,
} from "../dist/review/git.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { classifyChangedContent } from "../dist/server/changed_content.js";
import { generatedViews } from "../packages/viewer/dist/data.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import {
  assertRejectedResource,
  rejected,
  type ClassifierName,
  type RejectionKind,
} from "./helpers/deleted_resource_expectations.js";
import { validEntrySource } from "./helpers/fixture.js";

type ResourceKind = "embedded HTML" | "image" | "stylesheet";
type CurrentState =
  "absent" | "dangling" | "deleted" | "escaping" | "source-root";

interface DeletionCase {
  baseline: "absent" | "regular";
  current: CurrentState;
  expected: "changed" | Readonly<Record<ClassifierName, RejectionKind>>;
  kind: ResourceKind;
  storage: "blobs" | "rebuild";
  unsafe?: boolean;
}

const deletionCases: readonly DeletionCase[] = [
  ...(["blobs", "rebuild"] as const).flatMap((storage) =>
    (["stylesheet", "image", "embedded HTML"] as const).map((kind) => ({
      baseline: "regular" as const,
      current: "deleted" as const,
      expected: "changed" as const,
      kind,
      storage,
    })),
  ),
  {
    baseline: "absent",
    current: "absent",
    expected: rejected("baseline-missing", "current-missing"),
    kind: "image",
    storage: "blobs",
  },
  {
    baseline: "absent",
    current: "absent",
    expected: rejected("baseline-missing", "current-missing"),
    kind: "embedded HTML",
    storage: "rebuild",
  },
  {
    baseline: "absent",
    current: "absent",
    expected: rejected("baseline-missing", "unsafe-view"),
    kind: "stylesheet",
    storage: "blobs",
    unsafe: true,
  },
  {
    baseline: "absent",
    current: "absent",
    expected: rejected("baseline-missing", "current-missing"),
    kind: "image",
    storage: "rebuild",
    unsafe: true,
  },
  {
    baseline: "regular",
    current: "dangling",
    expected: rejected("dangling", "dangling"),
    kind: "image",
    storage: "blobs",
  },
  {
    baseline: "regular",
    current: "escaping",
    expected: rejected("escaping", "escaping"),
    kind: "image",
    storage: "rebuild",
  },
  {
    baseline: "regular",
    current: "source-root",
    expected: rejected("source-root", "source-root"),
    kind: "image",
    storage: "blobs",
  },
];

for (const scenario of deletionCases) {
  const label = `${scenario.storage} ${scenario.kind}, ${scenario.baseline} at branch point, ${scenario.current} now`;
  test(`deleted-resource classifiers agree: ${label}`, async (t) => {
    const route = resourceRoute(scenario.kind);
    const reference = `../../${route}`;
    const fixture = await changedFixture(
      t,
      validEntrySource({ body: resourceMarkup(scenario.kind, reference) }),
      undefined,
      async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, route),
          resourceContent(scenario.kind),
        );
      },
    );
    const resource = path.join(fixture.mockupsDir, route);
    await fs.unlink(resource);
    if (scenario.current === "dangling")
      await fs.symlink("missing.svg", resource);
    if (scenario.current === "escaping")
      await fs.symlink("../notes.md", resource);
    let config = fixture.config;
    if (scenario.current === "source-root") {
      const entriesDir = path.join(fixture.mockupsDir, "src/entries");
      await fs.mkdir(entriesDir, { recursive: true });
      await fs.writeFile(path.join(entriesDir, "private.svg"), "private");
      await fs.symlink("src/entries/private.svg", resource);
      config = { ...config, entriesDir };
    }
    const manifest = readManifest(fixture.config);
    const home = manifest.entries.find((entry) => entry.id === "home")!;
    const viewPaths = generatedViews(home).map((view) => view.path);
    const outputs = new Map(fixture.compilation.outputs);
    if (scenario.unsafe)
      for (const viewPath of viewPaths)
        outputs.set(
          viewPath,
          String(outputs.get(viewPath)).replace(reference, `../../../${route}`),
        );
    const repository = new CommittedRepository(
      new NodeGitCommandRunner(fixture.root),
    );
    const commit = await repository.evidence.mergeBase("main", "HEAD");
    const changedPaths = [
      `mockups/${route}`,
      ...(scenario.unsafe
        ? viewPaths.map((viewPath) => `mockups/${viewPath}`)
        : []),
    ];
    const baselineReader =
      scenario.baseline === "regular"
        ? repository.reader
        : {
            fileExists: async (base: string, candidate: string) =>
              candidate === `mockups/${route}`
                ? false
                : repository.reader.fileExists(base, candidate),
            fileKind: async (base: string, candidate: string) =>
              candidate === `mockups/${route}`
                ? ("missing" as const)
                : repository.reader.fileKind(base, candidate),
            readFile: (base: string, candidate: string) =>
              repository.reader.readFile(base, candidate),
            readFileBytes: (base: string, candidate: string) =>
              repository.reader.readFileBytes(base, candidate),
          };
    const classifiers = [
      {
        name: "unified" as const,
        run: async () => {
          const result = await classifyComponents({
            after: manifest,
            afterReader: new CompiledReviewAssetReader(config, outputs),
            baseCommit: commit,
            baseRef: "main",
            before: manifest,
            beforeReader: new GitReviewAssetReader(
              config,
              baselineReader,
              commit,
              "mockups",
              manifest,
            ),
            changedPaths: asChangeEvidence(changedPaths),
            config,
          });
          return result.screens
            .find((screen) => screen.id === "home")
            ?.views.some((view) => view.reasons?.length);
        },
      },
      {
        name: "screen-level" as const,
        run: async () => {
          const result = await classifyChangedContent(
            manifest,
            manifest,
            config,
            baselineReader,
            commit,
            asChangeEvidence(changedPaths),
            new CompiledReviewAssetReader(config, outputs),
          );
          return result.changedPaths.some((changed) =>
            changed.endsWith("screens/home.mobile.html"),
          );
        },
      },
    ];
    const outcomes = await Promise.allSettled(
      classifiers.map((classifier) => classifier.run()),
    );
    for (const [index, classifier] of classifiers.entries()) {
      const context = `${classifier.name}: ${label}`;
      const outcome = outcomes[index]!;
      if (scenario.expected !== "changed") {
        assert.equal(outcome.status, "rejected", context);
        if (outcome.status === "rejected")
          assertRejectedResource(
            outcome.reason,
            scenario.expected[classifier.name],
            {
              route,
              resource,
              viewRoute: viewPaths[0]!,
            },
            context,
          );
        continue;
      }
      assert.equal(
        outcome.status,
        "fulfilled",
        `${context}: ${outcome.status === "rejected" ? String(outcome.reason) : ""}`,
      );
      if (outcome.status === "fulfilled")
        assert.equal(outcome.value, true, context);
    }
  });
}

function resourceRoute(kind: ResourceKind): string {
  if (kind === "stylesheet") return "deleted.css";
  if (kind === "embedded HTML") return "deleted.html";
  return "deleted.svg";
}

function resourceMarkup(kind: ResourceKind, reference: string): string {
  if (kind === "stylesheet")
    return `<link rel="stylesheet" href="${reference}" />`;
  if (kind === "embedded HTML")
    return `<iframe src="${reference}" title="Embedded"></iframe>`;
  return `<img src="${reference}" alt="Deleted" />`;
}

function resourceContent(kind: ResourceKind): string {
  if (kind === "stylesheet") return "main { color: red; }";
  if (kind === "embedded HTML") return "<p>Embedded</p>";
  return '<svg xmlns="http://www.w3.org/2000/svg" />';
}
