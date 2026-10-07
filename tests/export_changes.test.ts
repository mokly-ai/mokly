import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { capturedAssetReader } from "../dist/export/inputs.js";
import { exportCatalogue } from "../dist/export/run.js";
import { readManifest } from "../dist/registry/manifest.js";
import { asChangeEvidence } from "../dist/review/change_evidence.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { changedContentPaths } from "../dist/server/changed_content.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import {
  attribute,
  documentElements,
  documentText,
  textContent,
} from "./helpers/html.js";
import { screenVariantEntrySource } from "./helpers/screen_variant_fixture.js";

for (const resource of ["nested.css", "image.svg"]) {
  test(`exported Changes matches Serve for a transitive ${resource} edit`, async (context) => {
    const fixture = await changedFixture(
      context,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "home/index.html", stylesheets: ["home.css"] }],',
      },
      async ({ mockupsDir }) => {
        await fs.writeFile(
          path.join(mockupsDir, "home.css"),
          '@import "nested.css";',
        );
        await fs.writeFile(
          path.join(mockupsDir, "nested.css"),
          '@import "home.css"; body { background: url("image.svg"); }',
        );
        await fs.writeFile(
          path.join(mockupsDir, "image.svg"),
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        );
      },
    );
    await fs.appendFile(
      path.join(fixture.mockupsDir, resource),
      resource.endsWith(".css") ? "\nmain { color: red; }" : "\n",
    );
    assert.deepEqual(
      await computeChangedPaths(
        fixture.config,
        "HEAD",
        committedReviewRepository(fixture.config),
      ),
      ["home", "tour"],
    );
    const result = await exportCatalogue(fixture.config, {
      outDir: "site",
      base: "HEAD",
    });
    const html = await fs.readFile(
      path.join(result.outDir, "index.html"),
      "utf8",
    );
    for (const id of ["home", "tour"])
      assert.match(
        html,
        new RegExp(`data-changed="true"[^>]*data-entry-id="${id}"`),
      );
    assert.doesNotMatch(
      html,
      /data-changed="true"[^>]*data-entry-id="details"/,
    );
  });
}

test("screen-only exports retain dark-only changed-view evidence", async (context) => {
  const fixture = await changedFixture(
    context,
    validEntrySource(),
    {
      extraConfig: `colorSchemes: ["light", "dark"],
stylesheets: [{ match: "home/index.html", stylesheets: [], darkStylesheets: ["dark.css"] }],`,
    },
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "dark.css"),
        "main { color: black; }\n",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "dark.css"),
    "main { color: red; }\n",
  );

  const result = await exportCatalogue(fixture.config, {
    outDir: "site",
    base: "HEAD",
  });
  const html = await fs.readFile(
    path.join(result.outDir, "view/home/index.html"),
    "utf8",
  );
  const serialized = html.match(
    /<script[^>]*data-workspace-data=""[^>]*>([\s\S]*?)<\/script>/,
  );
  assert.ok(serialized);
  const workspace = JSON.parse(serialized[1]!) as {
    changedViews: Readonly<Record<string, readonly unknown[]>>;
  };
  assert.deepEqual(workspace.changedViews.home, [
    { colorScheme: "dark", viewport: "mobile" },
    { colorScheme: "dark", viewport: "desktop" },
  ]);
  const schemeMark = documentElements(
    html,
    (element) => attribute(element, "data-view-changed") === "scheme",
  )[0];
  assert.ok(schemeMark);
  assert.equal(attribute(schemeMark, "hidden"), undefined);
  const changedViews = documentElements(
    html,
    (element) =>
      attribute(element, "data-workspace-changed-views") !== undefined,
  )[0];
  assert.ok(changedViews);
  assert.equal(
    textContent(changedViews),
    "Changed viewsMobile · Dark, Desktop · Dark",
  );
});

test("material Changes can use captured documents without reading current file bytes", async (context) => {
  const fixture = await changedFixture(context);
  const manifest = readManifest(fixture.config);
  const captured = await directoryFiles(fixture.mockupsDir);
  const fragment = "home/index.mobile.html";
  const generatedFragment = `mokly-generated/${fragment}`;
  captured.set(
    generatedFragment,
    Buffer.from(
      captured.get(generatedFragment)!.toString().replace("Details", "Next"),
    ),
  );
  const git = new CommittedRepository(new NodeGitCommandRunner(fixture.root));
  const commit = await git.evidence.mergeBase("HEAD", "HEAD");
  const reads: string[] = [];
  const result = await changedContentPaths(
    manifest,
    manifest,
    fixture.config,
    git.reader,
    commit,
    asChangeEvidence([`mockups/${generatedFragment}`]),
    {
      ...capturedAssetReader(captured, fixture.config),
      read: async (route) => {
        reads.push(route);
        const bytes =
          captured.get(`mokly-generated/${route}`) ?? captured.get(route);
        assert.ok(bytes);
        return bytes;
      },
      readIfExists: async (route) =>
        captured.get(`mokly-generated/${route}`) ?? captured.get(route),
    },
  );
  assert.deepEqual(result, [`mockups/${generatedFragment}`]);
  assert.ok(reads.includes(generatedFragment));
});

test("review export retains a removed variant route and parent context", async (context) => {
  const fixture = await createExportFixture(
    screenVariantEntrySource().replace('path: "home"', 'path: "fixture/home"'),
  );
  context.after(() => fixture.close());
  await fs.writeFile(
    fixture.entryPath,
    screenVariantEntrySource({ includeVariant: false }).replace(
      'path: "home"',
      'path: "fixture/home"',
    ),
  );

  await exportCatalogue(fixture.config, { outDir: "site" });
  const route = "fixture/home/empty/index.html";
  const removed = await fs.readFile(
    path.join(fixture.output, "view", route),
    "utf8",
  );
  assert.match(documentText(removed), /Showing previous version/);
  assert.match(documentText(removed), /Previous version unavailable/);
  assert.doesNotMatch(documentText(removed), /This screen was removed/);
  assert.match(
    removed,
    /<div class="mbk-nav-variants" data-nav-disclosure="variants:fixture\/home"[^>]*id="mb-nav-variants-specs-fixture\/home"><a [^>]*data-nav-removed=""[^>]*data-removed-variant=""/,
  );
  assert.match(removed, /Home empty · Removed/);
  await assert.rejects(fs.access(path.join(fixture.output, "id")));

  const catalogue = JSON.parse(
    await fs.readFile(
      path.join(fixture.output, "mokly-viewer/catalogue.json"),
      "utf8",
    ),
  ) as {
    removedEntries: {
      entry: { path: string; variantOf?: string };
      folderTitles: readonly string[];
    }[];
  };
  const snapshot = catalogue.removedEntries.find(
    ({ entry }) => entry.path === "fixture/home/empty",
  );
  assert.equal(snapshot?.entry.variantOf, "fixture/home");
  assert.deepEqual(snapshot?.folderTitles, ["Fixture"]);
});
