import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { generatedText } from "../dist/build/generated_file.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { removedManifestEntries } from "../dist/registry/changes.js";
import {
  RepositoryRemovedPagePreview,
  captureRemovedPagePreviews,
  packageRemovedPagePreviews,
} from "../dist/review/page_preview.js";
import { committedReviewRepository } from "../dist/review/repository.js";
import { computeChangedPaths } from "../dist/server/changed.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { baselineReader } from "./helpers/removed_page_preview_fixture.js";

const markdown =
  '---\ntitle: Guide\ndescription: How to start\ntags: ["guide"]\n---\n# Getting started\n\nRead the guide.\n\n![Diagram](diagram.png)';

test("a linked PDF resource marks its document changed", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    undefined,
    async (f) => {
      await fs.writeFile(
        path.join(f.entriesDir, "guide.md"),
        "# Guide\n\n[Download](attachment.pdf)",
      );
      await fs.writeFile(
        path.join(f.entriesDir, "attachment.pdf"),
        "%PDF-before",
      );
    },
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "attachment.pdf"),
    "%PDF-after",
  );
  await fixture.build();
  assert.deepEqual(
    await computeChangedPaths(
      fixture.config,
      "HEAD",
      committedReviewRepository(fixture.config),
    ),
    ["guide"],
  );
});

for (const change of [
  "body",
  "metadata",
  "resource",
  "format",
  "source-move",
  "scheme",
] as const)
  test(`document Changes classifies ${change} from rendered material and metadata`, async (t) => {
    const fixture = await changedFixture(
      t,
      validEntrySource(),
      { extraConfig: 'colorSchemes:["light", "dark"],' },
      async (f) => {
        await fs.writeFile(path.join(f.entriesDir, "guide.md"), markdown);
        await fs.writeFile(
          path.join(f.entriesDir, "diagram.png"),
          new Uint8Array([0, 255, 128, 1]),
        );
      },
    );
    if (change === "resource")
      await fs.writeFile(
        path.join(fixture.entriesDir, "diagram.png"),
        new Uint8Array([1, 2, 3, 4]),
      );
    else if (change === "source-move") {
      await fs.rename(
        path.join(fixture.entriesDir, "guide.md"),
        path.join(fixture.entriesDir, "renamed.md"),
      );
      await fs.writeFile(
        path.join(fixture.entriesDir, "renamed.md"),
        markdown.replace("title: Guide", "path: guide\ntitle: Guide"),
      );
    } else if (change === "scheme") {
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          '["light", "dark"]',
          '["light"]',
        ),
      );
    } else
      await fs.writeFile(
        path.join(fixture.entriesDir, "guide.md"),
        change === "body"
          ? markdown.replace("Read the guide.", "Read the updated guide.")
          : change === "metadata"
            ? markdown.replace("How to start", "Start your project")
            : markdown
                .replace("title: Guide", 'title: "Guide"')
                .replaceAll("\n", "\r\n"),
      );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const changed = await computeChangedPaths(
      config,
      "HEAD",
      committedReviewRepository(config),
    );
    assert.ok(changed);
    assert.equal(
      changed.includes("guide"),
      !["format", "source-move"].includes(change),
    );
  });

test("derived document resource changes are compared from bytes without a changed Git output path", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    undefined,
    async (f) => {
      await fs.writeFile(path.join(f.entriesDir, "guide.md"), markdown);
      await fs.writeFile(path.join(f.entriesDir, "diagram.png"), "before");
    },
  );
  const repository = committedReviewRepository(fixture.config);
  const commit = await repository.evidence.mergeBase("HEAD", "HEAD");
  const before = await compileCatalogue(fixture.config);
  const after = await compileCatalogue(fixture.config);
  const outputs = new Map(after.outputs);
  outputs.set("diagram.png", new Uint8Array(Buffer.from("after")));
  const config = { ...fixture.config, generatedOutput: "derived" as const };
  const evidence = await readCatalogueChanges(
    config,
    after.manifest,
    "HEAD",
    repository,
    commit,
    { outputs, routes: [...outputs.keys()], deliveredStyleSources: [] },
  );
  assert.ok(evidence.changedEntries?.includes("guide"));
  assert.equal(
    generatedText(before.outputs.get("guide/index.html")!, "guide"),
    generatedText(after.outputs.get("guide/index.html")!, "guide"),
  );
});

test("removed documents capture both historical schemes and resource bytes with page metadata", async (t) => {
  const fixture = await changedFixture(
    t,
    validEntrySource(),
    { extraConfig: 'colorSchemes:["light", "dark"],' },
    async (f) => {
      await fs.writeFile(
        path.join(f.entriesDir, "guide.md"),
        markdown + "\n\n[Download](attachment.pdf)",
      );
      await fs.writeFile(
        path.join(f.entriesDir, "attachment.pdf"),
        "%PDF-before",
      );
      await fs.writeFile(
        path.join(f.entriesDir, "diagram.png"),
        new Uint8Array([0, 255, 128, 1]),
      );
    },
  );
  const before = await compileCatalogue(fixture.config);
  await fs.rm(path.join(fixture.entriesDir, "guide.md"));
  await fs.rm(path.join(fixture.entriesDir, "diagram.png"));
  await fs.rm(path.join(fixture.entriesDir, "attachment.pdf"));
  const after = await compileCatalogue(await loadConfig(fixture.root));
  const removedEntries = removedManifestEntries(
    after.manifest,
    before.manifest,
  );
  assert.equal(removedEntries[0]!.entry.kind, "document");
  const files = new Map(
    [...before.outputs].map(([route, content]) => [
      `mockups/${route}`,
      {
        kind: "regular" as const,
        bytes: typeof content === "string" ? Buffer.from(content) : content,
      },
    ]),
  );
  const source = {
    baseline: before.manifest,
    baseCommit: "b".repeat(40),
    baseRef: "main",
    schemaVersion: 2 as const,
    changedEntries: ["guide"],
    movedEntries: [],
    removedEntries,
  };
  const provider = new RepositoryRemovedPagePreview(
    fixture.config,
    baselineReader(files),
  );
  const previews = await captureRemovedPagePreviews(
    provider,
    source,
    new AbortController().signal,
  );
  const packaged = packageRemovedPagePreviews(new Map(), previews);
  assert.ok(packaged.has("previews/guide/index.json"));
  assert.equal(
    Buffer.from(
      packaged.get("snapshots/before/attachment.pdf") ?? [],
    ).toString(),
    "%PDF-before",
  );
  for (const scheme of ["light", "dark"]) {
    const route = `guide/index${scheme === "dark" ? ".dark" : ""}.html`;
    assert.deepEqual(
      Buffer.from(packaged.get(`snapshots/before/${route}`)!),
      Buffer.from(before.outputs.get(route)!),
    );
  }
  assert.deepEqual(
    Buffer.from(packaged.get("snapshots/before/diagram.png")!),
    Buffer.from([0, 255, 128, 1]),
  );
  assert.deepEqual(previews.get("guide")!.preview, {
    schemaVersion: 3,
    baseCommit: "b".repeat(40),
    baseRef: "main",
    path: "guide",
  });
  files.delete("mockups/diagram.png");
  await assert.rejects(
    captureRemovedPagePreviews(provider, source, new AbortController().signal),
    /missing|not.*regular|does not exist/,
  );
});
