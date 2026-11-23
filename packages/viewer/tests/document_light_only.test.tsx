import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { ColorScheme } from "@mokly/model";

import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import { CanvasReadingStage } from "../src/shell/canvas_reading.js";
import { CanvasRemovedStage } from "../src/shell/canvas_removed.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { DisplaySelection } from "../src/shell/display_context.js";
import { DocumentStageFrame } from "../src/shell/document_stage_frame.js";
import { removedPreviewData } from "../src/shell/previews.js";
import { defaultSelection } from "../src/shell/selection.js";

import { indexFixture } from "./catalogue_v9_fixture.js";
import { storeMarkup } from "./shell_markup.js";

const BAND =
  '<p class="mbk-previous mbk-scheme-fallback mbk-reset" data-color-scheme-fallback=""><span class="mbk-frame-scheme-note mbk-reset">Light only</span></p>';

function fixtureDocument(colorSchemes: ColorScheme[]) {
  const document = indexFixture().documents[0];
  assert.ok(document);
  return { ...document, colorSchemes };
}

test("a current document with no dark render names its fallback above its pane", () => {
  const stage = (colorSchemes: ColorScheme[], hasDarkFragments: boolean) =>
    storeMarkup(
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

test("on the canvas, a document with no dark render names its fallback in its label under Dark", () => {
  const label = (
    colorSchemes: ColorScheme[],
    screenSchemes: ColorScheme[],
    colorScheme: ColorScheme,
  ) => {
    const index = indexFixture((raw) => {
      for (const screen of raw.screens) screen.colorSchemes = screenSchemes;
      for (const document of raw.documents)
        document.colorSchemes = colorSchemes;
    });
    const catalogue = createCatalogue(shellCatalogueModel(index, new Map()));
    const entry = catalogue.byPath.get("product");
    assert.ok(entry?.kind === "document");
    const html = storeMarkup(
      <DisplaySelection value={{ ...defaultSelection, colorScheme }}>
        <CanvasReadingStage catalogue={catalogue} entry={entry} />
      </DisplaySelection>,
      { index },
    );
    assert.doesNotMatch(html, /mbk-scheme-fallback/u);
    return /<span class="mbk-canvas-frame-name mbk-reset">([^<]*)<\/span>/u.exec(
      html,
    )?.[1];
  };
  assert.equal(
    label(["light"], ["light", "dark"], "dark"),
    "README.md · Light only",
  );
  assert.equal(label(["light"], ["light", "dark"], "light"), "README.md");
  assert.equal(
    label(["light", "dark"], ["light", "dark"], "dark"),
    "README.md",
  );
  assert.equal(label(["light"], ["light"], "dark"), "README.md");
});

/** A removed document under the fixture's product folder. */
const REMOVED = "product/terms";

/** A stable 64-digit hash for a test identity. */
const hash = (seed: string) => createHash("sha256").update(seed).digest("hex");

/** The address of a removed document's historical version of one scheme. */
const historical = (colorScheme: ColorScheme) =>
  `https://catalogue.test/snapshots/before/${REMOVED}/index.${colorScheme}.html`;

/**
 * The loaded previous version of a removed document in a published catalogue
 * whose current screens render `screenSchemes`, under the preview scheme
 * `colorScheme`.
 */
function removedStage(
  screenSchemes: readonly ColorScheme[],
  documentSchemes: readonly ColorScheme[],
  colorScheme: ColorScheme = "dark",
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
  const views = documentSchemes.map((scheme) => ({
    colorScheme: scheme,
    url: historical(scheme),
  }));
  return storeMarkup(
    <CanvasRemovedStage
      colorScheme={colorScheme}
      data={data}
      retry={() => undefined}
      state={{
        status: "ready",
        loaded: {
          content: { kind: "document", views },
          generation: "https://catalogue.test/",
          url: `https://catalogue.test/previews/${REMOVED}/index.json`,
        },
        presentations: new Map(
          views.map(({ url }) => [url, { snapshotAddress: url, srcdoc: "" }]),
        ),
      }}
      viewport="both"
    />,
    { index },
  );
}

/** The quiet label of the section's head, and the document that it shows. */
function shown(html: string) {
  return {
    label:
      /<span class="mbk-canvas-quiet-label mbk-reset">([^<]*)<\/span>/u.exec(
        html,
      )?.[1],
    source: /data-mokly-preview-source="([^"]*)"/u.exec(html)?.[1],
  };
}

test("a removed document with no dark render keeps its light version under Dark, and its section's label says so", () => {
  assert.deepEqual(shown(removedStage(["light", "dark"], ["light"])), {
    label: "Showing previous version — Light only",
    source: historical("light"),
  });
  assert.deepEqual(shown(removedStage(["light", "dark"], ["light"], "light")), {
    label: "Showing previous version",
    source: historical("light"),
  });
  // A document with a dark version shows it under Dark, and a catalogue
  // without a dark axis names no fallback.
  assert.deepEqual(shown(removedStage(["light", "dark"], ["light", "dark"])), {
    label: "Showing previous version",
    source: historical("dark"),
  });
  assert.deepEqual(shown(removedStage(["light"], ["light"])), {
    label: "Showing previous version",
    source: historical("light"),
  });
});
