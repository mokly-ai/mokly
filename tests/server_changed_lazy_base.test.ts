import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { readManifest } from "../dist/registry/manifest.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import { CommittedBaselineReader } from "../dist/review/committed.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { classifyChangedContent } from "../dist/server/changed_content.js";
import { ChangedResourceGraph } from "../dist/server/changed_resources.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";

for (const resource of ["image.svg", "unused.css", "shared.css"])
  test(`live ${resource} changes read base documents only for CSS consumers`, async (t) => {
    const fixture = await cssAttributionFixture(t, false, {
      prepare: async ({ configPath }) => {
        await fs.writeFile(
          configPath,
          (await fs.readFile(configPath, "utf8")).replace(
            'match: "**/*.html"',
            'match: "screens/home.html"',
          ),
        );
      },
    });
    await fixture.append("\n.auth { color: blue; }", resource);
    const reads: string[] = [];
    class ObservedGit extends CommittedBaselineReader {
      override async readFiles(commit: string, paths: readonly string[]) {
        reads.push(...paths);
        return super.readFiles(commit, paths);
      }
    }
    const runner = new NodeGitCommandRunner(fixture.root);
    const descriptor = committedReviewRepository(fixture.config).descriptor;
    assert.ok(descriptor);
    const git = {
      evidence: new CommittedRepository(runner).evidence,
      reader: new ObservedGit(runner, descriptor),
    };
    const manifest = readManifest(fixture.config);
    await classifyChangedContent(
      manifest,
      manifest,
      fixture.config,
      git.reader,
      await git.evidence.mergeBase("main", "HEAD"),
      [`mockups/${resource}`],
      new CompiledReviewAssetReader(
        fixture.config,
        (await compileCatalogue(fixture.config)).outputs,
      ),
    );
    const documents = reads.filter((route) => route.endsWith(".html"));
    assert.deepEqual(documents.sort(), [
      "mockups/.generated/screens/details.desktop.dark.html",
      "mockups/.generated/screens/details.desktop.html",
      "mockups/.generated/screens/details.mobile.dark.html",
      "mockups/.generated/screens/details.mobile.html",
      "mockups/.generated/screens/home.desktop.dark.html",
      "mockups/.generated/screens/home.desktop.html",
      "mockups/.generated/screens/home.mobile.dark.html",
      "mockups/.generated/screens/home.mobile.html",
    ]);
    assert.deepEqual(
      [...new Set(reads.filter((route) => !route.endsWith(".html")))].sort(),
      ["mockups/font.woff2", "mockups/image.svg", "mockups/shared.css"],
    );
  });

test("non-CSS evidence does not traverse a supplied base resource graph", async (t) => {
  const fixture = await cssAttributionFixture(t, false);
  const document = await fs.readFile(
    path.join(fixture.config.generatedDir, "screens/home.mobile.html"),
    "utf8",
  );
  const graph = new ChangedResourceGraph(
    new FileSystemReviewAssetReader(fixture.config),
    {
      read: async () => {
        throw new Error("Unexpected base graph traversal");
      },
    },
    new Set(["image.svg"]),
    new Map(),
    undefined,
    false,
    { prefix: ".generated", routes: new Set(["screens/home.mobile.html"]) },
    { prefix: ".generated", routes: new Set(["screens/home.mobile.html"]) },
  );
  assert.deepEqual(
    await graph.compare("screens/home.mobile.html", document, {
      path: "screens/home.mobile.html",
      html: document,
    }),
    {
      reasons: [{ kind: "dependency", path: "image.svg" }],
    },
  );
});

test("deleted stylesheet resources still retain their consumers", async (t) => {
  const fixture = await cssAttributionFixture(t, false);
  const accepted = await compileCatalogue(fixture.config);
  await fs.unlink(path.join(fixture.mockupsDir, "shared.css"));
  const manifest = readManifest(fixture.config);
  const git = committedReviewRepository(fixture.config);
  const result = await classifyChangedContent(
    manifest,
    manifest,
    fixture.config,
    git.reader,
    await git.evidence.mergeBase("main", "HEAD"),
    ["mockups/shared.css"],
    new CompiledReviewAssetReader(fixture.config, accepted.outputs),
  );
  assert.ok(
    result.changedPaths.includes("mockups/.generated/screens/home.mobile.html"),
  );
  assert.equal(
    result.screens[0]?.views[0]?.reasons?.[0]?.analysis?.status,
    "unresolved",
  );
});

test("changed documents retain a removed image without any stylesheet in the diff", async (t) => {
  const image = '<img src="../../image.svg" alt="Logo" />';
  const fixture = await changedFixture(
    t,
    validEntrySource({ body: `<p>Home</p>${image}` }),
    undefined,
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "image.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      );
    },
  );
  const baseline = readManifest(fixture.config);
  await fs.writeFile(
    fixture.entryPath,
    (await fs.readFile(fixture.entryPath, "utf8")).replaceAll(image, ""),
  );
  await fs.unlink(path.join(fixture.mockupsDir, "image.svg"));
  await fixture.build();
  const git = committedReviewRepository(fixture.config);
  const commit = await git.evidence.mergeBase("main", "HEAD");
  const changedPaths = await git.evidence.changedPaths(commit);
  assert.ok(changedPaths.includes("mockups/image.svg"));
  assert.ok(changedPaths.every((route) => !/\.css$/i.test(route)));
  const result = await classifyChangedContent(
    readManifest(fixture.config),
    baseline,
    fixture.config,
    git.reader,
    commit,
    changedPaths,
    new CompiledReviewAssetReader(
      fixture.config,
      (await compileCatalogue(fixture.config)).outputs,
    ),
  );
  for (const viewport of ["mobile", "desktop"])
    assert.ok(
      result.changedPaths.includes(
        `mockups/.generated/screens/home.${viewport}.html`,
      ),
    );
  const consumer = result.screens.find(
    (screen) => screen.route === "screens/home.html",
  );
  assert.equal(consumer?.views.length, 2);
  for (const view of consumer!.views)
    assert.deepEqual(view.reasons, [
      { kind: "dependency", path: "mockups/image.svg" },
    ]);
});

test("moved documents retain changed stylesheets reachable only from their base route", async (t) => {
  const fixture = await cssAttributionFixture(t, false, {
    prepare: async ({ mockupsDir }) => {
      for (const directory of ["old", "new"]) {
        await fs.mkdir(path.join(mockupsDir, directory));
        await fs.writeFile(
          path.join(mockupsDir, directory, "theme.css"),
          ".auth { color: red; }",
        );
      }
    },
  });
  await fixture.append(".auth { padding: 2px; }", "old/theme.css");
  const git = new CommittedRepository(new NodeGitCommandRunner(fixture.root));
  const graph = new ChangedResourceGraph(
    new FileSystemReviewAssetReader(fixture.config),
    new GitReviewAssetReader(
      fixture.config,
      git.reader,
      await git.evidence.mergeBase("main", "HEAD"),
      "mockups",
    ),
    new Set(["old/theme.css"]),
    new Map(),
  );
  const document =
    '<!doctype html><link rel="stylesheet" href="theme.css"><p class="auth">Sign in</p>';
  const result = await graph.compare("new/view.html", document, {
    path: "old/view.html",
    html: document,
  });
  assert.equal(result.reasons?.[0]?.path, "old/theme.css");
  assert.equal(result.reasons?.[0]?.analysis?.status, "matched");
});
