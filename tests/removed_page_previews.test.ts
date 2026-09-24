import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { HistoricalManifest } from "@mokly/viewer/data";
import { parseRemovedPagePreview } from "@mokly/viewer/data";

import {
  renderRemovedPagePreviewArtifact,
  RepositoryRemovedPagePreview,
} from "../dist/review/page_preview.js";

import {
  PAGE_COMMIT,
  PAGE_ROUTE,
  baselineReader,
  removedPagePreviewFixture,
} from "./helpers/removed_page_preview_fixture.js";

for (const version of [4, 5] as const) {
  test(`removed page captures its complete historical closure from manifest v${version}`, async (t) => {
    const fixture = await removedPagePreviewFixture(t, version);
    const artifact = await new RepositoryRemovedPagePreview(
      fixture.config,
      fixture.reader,
    ).generate(
      fixture.source,
      { kind: "page", route: PAGE_ROUTE },
      new AbortController().signal,
    );
    const files = renderRemovedPagePreviewArtifact(artifact);

    assert.deepEqual(artifact.preview, {
      schemaVersion: 1,
      baseRef: "main",
      baseCommit: PAGE_COMMIT,
      route: PAGE_ROUTE,
      documentPath: `snapshots/before/${PAGE_ROUTE}`,
    });
    assert.deepEqual(
      parseRemovedPagePreview(JSON.parse(String(files.get("preview.json")))),
      artifact.preview,
    );
    assert.equal(files.size, fixture.files.size + 1);
    for (const [repoPath, value] of fixture.files) {
      assert.deepEqual(
        Buffer.from(
          files.get(`snapshots/before/${repoPath.slice("mockups/".length)}`)!,
        ),
        Buffer.from(value.bytes!),
        repoPath,
      );
    }
    assert.deepEqual(
      fixture.batches.map((batch) => batch.length),
      [1, 3, 4, 1],
    );
  });
}

test("removed page capture rejects missing documents and every missing dependency", async (t) => {
  const fixture = await removedPagePreviewFixture(t);
  for (const missing of [
    `mockups/${PAGE_ROUTE}`,
    "mockups/assets/main.css",
    "mockups/assets/theme.css",
    "mockups/assets/direct.png",
    "mockups/assets/font.woff2",
    "mockups/assets/background.png",
    "mockups/assets/nested.png",
    "mockups/assets/embed.html",
    "mockups/assets/embedded.png",
  ]) {
    const files = new Map(fixture.files);
    files.delete(missing);
    await assert.rejects(
      new RepositoryRemovedPagePreview(
        fixture.config,
        baselineReader(files),
      ).generate(
        fixture.source,
        { kind: "page", route: PAGE_ROUTE },
        new AbortController().signal,
      ),
      /Snapshot file is missing/,
      missing,
    );
  }
});

test("removed page capture rejects a selection outside the accepted removal snapshot", async (t) => {
  const fixture = await removedPagePreviewFixture(t);
  await assert.rejects(
    new RepositoryRemovedPagePreview(fixture.config, fixture.reader).generate(
      fixture.source,
      { kind: "page", route: "archive/missing.html" },
      new AbortController().signal,
    ),
    /selected view has no comparison/,
  );
  await assert.rejects(
    new RepositoryRemovedPagePreview(fixture.config, fixture.reader).generate(
      {
        ...fixture.source,
        baseline: { ...fixture.baseline, entries: [] } as HistoricalManifest,
      },
      { kind: "page", route: PAGE_ROUTE },
      new AbortController().signal,
    ),
    /removed page does not match the pinned baseline/,
  );
});

for (const [name, reference, message] of [
  ["root absolute", "/assets/main.css", /root-absolute/],
  ["protocol relative", "//example.invalid/main.css", /protocol-relative/],
  ["unsupported scheme", "file:///tmp/main.css", /unsupported scheme/],
  ["path traversal", "../../private.css", /escapes mockupsDir/],
] as const) {
  test(`removed page capture rejects ${name} resource URLs`, async (t) => {
    const fixture = await removedPagePreviewFixture(t);
    fixture.files.set(`mockups/${PAGE_ROUTE}`, {
      bytes: Buffer.from(`<link rel="stylesheet" href="${reference}">`),
      kind: "regular",
    });
    await assert.rejects(
      new RepositoryRemovedPagePreview(fixture.config, fixture.reader).generate(
        fixture.source,
        { kind: "page", route: PAGE_ROUTE },
        new AbortController().signal,
      ),
      message,
    );
  });
}

test("removed page capture denies traversal, symlinks, metadata, and authored sources", async (t) => {
  const fixture = await removedPagePreviewFixture(t);
  const unsafeSource = {
    ...fixture.source,
    baseline: {
      ...fixture.baseline,
      entries: [{ ...fixture.page, route: "../guide.html" }],
    } as HistoricalManifest,
    removedEntries: [
      { entry: { ...fixture.page, route: "../guide.html" }, ancestors: [] },
    ],
  };
  await assert.rejects(
    new RepositoryRemovedPagePreview(fixture.config, fixture.reader).generate(
      unsafeSource,
      { kind: "page", route: "../guide.html" },
      new AbortController().signal,
    ),
    /unsafe path/,
  );

  for (const [reference, denied] of [
    ["../assets/linked.css", /not a regular Git file \(symlink\)/],
    ["../mokly-manifest.json", /internal catalogue metadata/],
    ["../assets/helper.source.html", /reserved source basename/],
    ["../assets/author.ts", /authoring input/],
  ] as const) {
    const files = new Map(fixture.files);
    files.set(`mockups/${PAGE_ROUTE}`, {
      bytes: Buffer.from(`<link rel="stylesheet" href="${reference}">`),
      kind: "regular",
    });
    if (reference.endsWith("linked.css"))
      files.set("mockups/assets/linked.css", { kind: "symlink" });
    if (!("sourceFiles" in fixture.baseline))
      throw new Error("Expected a source-protected page manifest");
    const baseline = reference.endsWith("author.ts")
      ? {
          ...fixture.baseline,
          sourceFiles: [
            ...fixture.baseline.sourceFiles,
            "mockups/assets/author.ts",
          ],
        }
      : fixture.baseline;
    await assert.rejects(
      new RepositoryRemovedPagePreview(
        fixture.config,
        baselineReader(files),
      ).generate(
        { ...fixture.source, baseline },
        { kind: "page", route: PAGE_ROUTE },
        new AbortController().signal,
      ),
      denied,
      reference,
    );
  }
});

test("removed page capture applies the selected artifact byte limit", async (t) => {
  const fixture = await removedPagePreviewFixture(t);
  fixture.files.set("mockups/assets/direct.png", {
    bytes: new Uint8Array(64 * 1024 * 1024 + 1),
    kind: "regular",
  });
  await assert.rejects(
    new RepositoryRemovedPagePreview(fixture.config, fixture.reader).generate(
      fixture.source,
      { kind: "page", route: PAGE_ROUTE },
      new AbortController().signal,
    ),
    /exceeds 64 MiB/,
  );
});

test("preview reader strictly validates metadata and document identity", () => {
  const valid = {
    schemaVersion: 1,
    baseRef: "main",
    baseCommit: PAGE_COMMIT,
    route: PAGE_ROUTE,
    documentPath: `snapshots/before/${PAGE_ROUTE}`,
  };
  assert.deepEqual(parseRemovedPagePreview(valid), valid);
  for (const value of [
    { ...valid, schemaVersion: 2 },
    { ...valid, baseCommit: "invalid" },
    { ...valid, route: "../guide.html" },
    { ...valid, documentPath: "snapshots/after/archive/guide.html" },
    { ...valid, documentPath: "snapshots/before/archive/other.html" },
    { ...valid, extra: path.resolve("private") },
  ])
    assert.throws(() => parseRemovedPagePreview(value));
});
