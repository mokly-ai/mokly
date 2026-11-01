import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type { ColorScheme } from "../src/data/axes.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { DocumentStageFrame } from "../src/shell/document_stage_frame.js";
import {
  removedPreviewData,
  RemovedPreviewStage,
} from "../src/shell/previews.js";

import { indexFixture } from "./catalogue_v9_fixture.js";

const BAND =
  '<p class="mbk-previous mbk-scheme-fallback mbk-reset" data-color-scheme-fallback=""><span class="mbk-frame-scheme-note mbk-reset">Light only</span></p>';

function fixtureDocument(colorSchemes: ColorScheme[]) {
  const document = indexFixture().documents[0];
  assert.ok(document);
  return { ...document, colorSchemes };
}

test("a current document with no dark render names its fallback above its pane", () => {
  const stage = (colorSchemes: ColorScheme[], hasDarkFragments: boolean) =>
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

/** A removed document under the fixture's product folder. */
const REMOVED = "product/terms";

/** A stable 64-digit hash for a test identity. */
const hash = (seed: string) => createHash("sha256").update(seed).digest("hex");

/**
 * The previous-version stage of a removed document in a published catalogue
 * whose current screens render `screenSchemes`.
 */
function removedStage(
  screenSchemes: readonly ColorScheme[],
  documentSchemes: readonly ColorScheme[],
): string {
  const index = indexFixture((raw) => {
    for (const screen of raw.screens) {
      screen.colorSchemes = [...screenSchemes];
      // Each viewport in turn, then each scheme, as the index axes require.
      screen.views = (["mobile", "desktop"] as const).flatMap((viewport) => {
        const light = screen.views.find(
          (view) => view.viewport === viewport && view.colorScheme === "light",
        );
        assert.ok(light);
        return screenSchemes.map((colorScheme) => ({
          ...light,
          colorScheme,
          documentKey: hash(`${screen.path}:${viewport}:${colorScheme}`),
        }));
      });
    }
    const [document] = raw.documents;
    assert.ok(document);
    raw.removedEntries.push({
      entry: {
        ...document,
        changes: { included: true, kind: "removed", status: "ready" },
        colorSchemes: [...documentSchemes],
        details: { ...document.details, sourcePath: `specs/${REMOVED}.md` },
        documentKeys: documentSchemes.map((colorScheme) => ({
          colorScheme,
          documentKey: hash(`${REMOVED}:${colorScheme}`),
        })),
        path: REMOVED,
        title: "Terms",
      },
      folderTitles: ["Product overview"],
      preview: { kind: "document" },
      snapshotId: hash(`removed:${REMOVED}`),
    });
  });
  const catalogue = createCatalogue(shellCatalogueModel(index, new Map()));
  const removed = catalogue.byPath.get(REMOVED);
  assert.ok(removed);
  const data = removedPreviewData(
    catalogue,
    { base: "main", changesStatus: "ready" },
    removed,
  );
  assert.ok(data);
  return renderToStaticMarkup(<RemovedPreviewStage data={data} />);
}

test("a removed document with no dark render adds the note to its label", () => {
  assert.match(
    removedStage(["light", "dark"], ["light"]),
    /<p class="mbk-previous mbk-reset" data-color-scheme-fallback="">Showing previous version<span class="mbk-frame-scheme-note mbk-reset"> — Light only<\/span><\/p>/u,
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
      /<p class="mbk-previous mbk-reset">Showing previous version<\/p>/u,
    );
    assert.doesNotMatch(html, /Light only/u);
  }
});
