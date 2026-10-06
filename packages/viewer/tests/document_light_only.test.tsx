import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { ManifestEntry, ManifestV8 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import type { ShellContext } from "../src/shell/context.js";
import { SHELL_PREVIEW_CSS } from "../src/shell/css_previews.js";
import {
  removedPreviewData,
  RemovedPreviewStage,
} from "../src/shell/previews.js";
import { DocumentStageFrame } from "../src/shell/stage_frame.js";

import { currentManifestEntryFixture } from "./manifest_path_fixture.js";

const BAND =
  '<p class="mbk-previous mbk-scheme-fallback" data-color-scheme-fallback=""><span class="mbk-frame-scheme-note">Light only</span></p>';

function fixtureDocument(colorSchemes: readonly ("light" | "dark")[]) {
  const model = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const document = readCatalogue(model).documents[0];
  assert.ok(document);
  return { ...document, colorSchemes };
}

test("a current document with no dark render names its fallback above its pane", () => {
  const stage = (
    colorSchemes: readonly ("light" | "dark")[],
    hasDarkFragments: boolean,
  ) =>
    renderToStaticMarkup(
      <DocumentStageFrame
        entry={fixtureDocument(colorSchemes)}
        hasDarkFragments={hasDarkFragments}
      />,
    );
  const lightOnly = stage(["light"], true);
  assert.ok(lightOnly.startsWith(BAND), lightOnly.slice(0, 200));
  assert.match(lightOnly, /data-preview-color-scheme="light"/u);
  assert.doesNotMatch(stage(["light", "dark"], true), /mbk-scheme-fallback/u);
  assert.doesNotMatch(stage(["light"], false), /mbk-scheme-fallback/u);
});

const entry = (
  kind: "document" | "screen",
  path: string,
  colorSchemes: readonly ("light" | "dark")[],
): ManifestEntry =>
  ({
    colorSchemes,
    declaredDependencies: [],
    description: path,
    kind,
    path,
    relatedDocs: [],
    sourcePath: `specs/${path}.md`,
    title: path,
    ...(kind === "screen" ? { useCasePaths: [] } : {}),
  }) as unknown as ManifestEntry;

function removedStage(
  screenSchemes: readonly ("light" | "dark")[],
  documentSchemes: readonly ("light" | "dark")[],
): string {
  const manifest: ManifestV8 = {
    entries: [entry("screen", "guide/screen", screenSchemes)],
    folders: [],
    generatedBy: "mokly",
    schemaVersion: 8,
    sourceFiles: [],
  };
  const removed = entry("document", "guide/terms", documentSchemes);
  const catalogue = createCatalogue(manifest, [
    { entry: removed, folderTitles: ["Guide"] },
  ]);
  const context: ShellContext = {
    base: "main",
    changesStatus: "ready",
    updateVersion: 1,
  };
  const data = removedPreviewData(
    catalogue,
    context,
    currentManifestEntryFixture(removed),
  );
  assert.ok(data);
  return renderToStaticMarkup(<RemovedPreviewStage data={data} />);
}

test("a removed document with no dark render adds the note to its label", () => {
  assert.match(
    removedStage(["light", "dark"], ["light"]),
    /<p class="mbk-previous" data-color-scheme-fallback="">Showing previous version<span class="mbk-frame-scheme-note"> — Light only<\/span><\/p>/u,
  );
  for (const [screens, documents] of [
    [
      ["light", "dark"],
      ["light", "dark"],
    ],
    [["light"], ["light"]],
  ] as const) {
    const html = removedStage(screens, documents);
    assert.match(
      html,
      /<p class="mbk-previous">Showing previous version<\/p>/u,
    );
    assert.doesNotMatch(html, /Light only/u);
  }
});

test("the stylesheet names a document's fallback only under Dark", () => {
  const css = SHELL_PREVIEW_CSS.replace(/\s+/gu, " ");
  const dark = 'body[data-mokly-color-scheme="dark"]';
  for (const rule of [
    ".mbk-previous.mbk-scheme-fallback { display: none; }",
    `${dark} .mbk-previous.mbk-scheme-fallback { display: block; }`,
    `${dark} .mbk-previous[data-color-scheme-fallback] .mbk-frame-scheme-note { display: inline; }`,
  ])
    assert.ok(css.includes(rule), rule);
});
