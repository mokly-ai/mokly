import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ComponentViewRecord } from "@mokly/viewer";

import { loadConfig } from "../dist/config/load.js";
import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { parseHtmlLinks } from "../dist/html_links.js";
import { extractHtmlReferences } from "../dist/html_references.js";
import { applyInlineMaterial } from "../dist/review/css/inline_rendering.js";
import { normalizeResourceLinks } from "../dist/review/moves/resource_links.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import { originalPageReferences } from "../dist/review/page_reference_records.js";
import { discoverWatchResources } from "../dist/server/watch_resources.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const route = "mokly-generated/home/index.html";
const href = "../../sheet.css?v=1&x=2#theme";
const link =
  '<link rel="alternate StyleSheet" href="../../sheet.css?v=1&amp;x=2#theme">';

for (const [name, open, close, active] of [
  ["SVG", "<svg>", "</svg>", false],
  ["MathML", "<math>", "</math>", false],
  ["foreignObject", "<svg><foreignObject>", "</foreignObject></svg>", true],
] as const) {
  const source = `<html><head></head><body>${open}${link}${close}</body></html>`;

  test(`${name}: page references reuse one original parse and keep namespace scope`, async () => {
    const events: TimingEvent[] = [];
    await runWithTimings(
      true,
      "test",
      () =>
        runWithDocumentWork(() => {
          const page = new PageAnalysis(source, route);
          const expected = active ? [href] : [];
          assert.deepEqual(
            originalPageReferences(page.references).resources,
            expected,
          );
          assert.deepEqual(page.conservativeReferences([]), expected);
          assert.deepEqual(
            page.materialReferences(
              [{ kind: "source", start: 0, end: source.length }],
              [],
            ),
            expected,
          );
          assert.deepEqual(
            extractHtmlReferences(source, {}, page.document).resources,
            expected,
          );
          const found = parseHtmlLinks(source, page.document);
          assert.equal(found.document, page.document);
          assert.deepEqual(
            found.links.map((item) => item.attributes.get("href")),
            expected,
          );
        }),
      { write: (event) => events.push(event) },
    );
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(counts.htmlParses, 1);
    assert.equal(counts["htmlParses.pageAnalysis"], 1);
    assert.equal(counts["htmlParses.reference"] ?? 0, 0);
    assert.ok(Object.hasOwn(counts, "referenceMs"));
  });

  test(`${name}: original-coordinate stylesheet edits require an active link`, () => {
    const span = {
      startOffset: source.indexOf(link),
      endOffset: source.indexOf(link) + link.length,
      path: "sheet.css",
      componentPaths: ["action"],
    };
    const usage = {
      ranges: [],
      insertedStylesheets: [span],
    } as unknown as ComponentViewRecord;
    const page = new PageAnalysis(source, route, usage);
    if (!active) {
      assert.throws(
        () => page.stylesheetEdits(),
        /invalid inserted stylesheet span/,
      );
      return;
    }
    assert.deepEqual(page.stylesheetResources, ["sheet.css"]);
    assert.deepEqual(page.stylesheetEdits("action"), []);
    assert.equal(
      applyInlineMaterial(source, {
        replacements: page.stylesheetEdits(),
        appendix: "",
      }),
      source.replace(link, ""),
    );
  });

  test(`${name}: move normalization changes only active link hrefs`, () => {
    assert.equal(
      normalizeResourceLinks(source, route, "before"),
      active ? source.replace("../../sheet.css", "sheet.css") : source,
    );
  });

  test(`${name}: the watch closure uses the active resource scope`, async (t) => {
    const fixture = await createFixture(undefined, {
      extraConfig: "stylesheets: [],",
    });
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const sheet = path.join(fixture.mockupsDir, "sheet.css");
    if (active) await fs.writeFile(sheet, "body { color: red; }");
    const snapshot = await discoverWatchResources(config, {
      outputs: new Map([["home/index.html", source]]),
    });
    assert.equal(snapshot.closure.has("sheet.css"), active);
    assert.equal(snapshot.paths.has(sheet), active);
  });
}

test("foreign links do not hide SVG image and use resources", () => {
  const source =
    '<svg><link href="inactive.css"></link><image href="image.svg"/><use href="sprite.svg#one"/></svg>';
  const expected = ["image.svg", "sprite.svg#one"];
  assert.deepEqual(extractHtmlReferences(source).resources, expected);
  assert.deepEqual(
    new PageAnalysis(source, route).conservativeReferences([]),
    expected,
  );
});
