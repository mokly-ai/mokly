import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ComponentViewRecord } from "@mokly/viewer";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { finalizeComponentStylesheets } from "../dist/components/stylesheet_provenance.js";
import { rendererStylesheetPaths } from "../dist/components/stylesheet_reuse.js";
import { insertedStylesheetSpans } from "../dist/components/stylesheet_spans.js";
import { parseHtmlLinks } from "../dist/html_links.js";
import { extractHtmlReferences } from "../dist/html_references.js";
import { insertedStylesheetResources } from "../dist/review/component_stylesheet_resources.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const href = "../../action.css?v=1&x=2#theme";
const link =
  '<link rel="alternate StyleSheet" href="../../action.css?v=1&amp;x=2#theme">';
const route = "mokly-generated/checkout/index.mobile.html";
const head = "<html><head><title>Links</title>";
const insertion = '<link rel="stylesheet" href="../../action.css">';

async function stylesheetFixture(t: test.TestContext) {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const stylesheet = path.join(fixture.mockupsDir, "action.css");
  await fs.writeFile(stylesheet, ".action{color:red}");
  return { fixture, physical: await fs.realpath(stylesheet) };
}

for (const [name, open, close, active] of [
  ["SVG", "<svg>", "</svg>", false],
  ["MathML", "<math>", "</math>", false],
  ["foreignObject", "<svg><foreignObject>", "</foreignObject></svg>", true],
] as const) {
  const document = `${head}</head><body>${open}${link}${close}</body></html>`;
  const span = {
    startOffset: document.indexOf(link),
    endOffset: document.indexOf(link) + link.length,
    path: "action.css",
    componentPaths: ["action"],
  };

  test(`${name}: the shared finder uses the element namespace`, () => {
    const links = parseHtmlLinks(document).links;
    assert.deepEqual(
      links.map((found) => found.attributes.get("href")),
      active ? [href] : [],
    );
    if (active) {
      assert.equal(
        links[0]!.element.namespaceURI,
        "http://www.w3.org/1999/xhtml",
      );
      assert.equal(links[0]!.scope, "body");
      assert.equal(links[0]!.stylesheet, true);
    }
  });

  test(`${name}: resource discovery follows the shared finder`, () => {
    for (const rel of ["stylesheet", "icon", "preload"]) {
      const html = document.replace("alternate StyleSheet", rel);
      for (const resourceHints of [true, false]) {
        const found = extractHtmlReferences(html, { resourceHints });
        assert.deepEqual(
          found.resources,
          active && (resourceHints || rel !== "preload") ? [href] : [],
        );
        assert.deepEqual(found.hrefs, []);
      }
    }
  });

  test(`${name}: a configured link outside the HTML head uses the fallback`, () => {
    const warnings: BuildDiagnostic[] = [];
    const result = insertComponentStylesheets(
      document,
      route,
      [href],
      1,
      ["action.css"],
      (warning) => warnings.push(warning),
    );
    assert.equal(
      result,
      `${head}${insertion}</head><body>${open}${link}${close}</body></html>`,
    );
    assert.deepEqual(
      warnings.map(({ code, route }) => ({ code, route })),
      [{ code: "missing-configured-stylesheet-link", route }],
    );
  });

  test(`${name}: renderer reuse uses active links`, async (t) => {
    const { fixture, physical } = await stylesheetFixture(t);
    assert.deepEqual(
      [
        ...rendererStylesheetPaths(
          document,
          route,
          fixture.mockupsDir,
          new Set([physical]),
        ),
      ],
      active ? [[physical, "action.css"]] : [],
    );
  });

  test(`${name}: final provenance uses active links`, async (t) => {
    const { fixture, physical } = await stylesheetFixture(t);
    const result = finalizeComponentStylesheets(
      document,
      { insertedStylesheets: [] } as unknown as ComponentViewRecord,
      "checkout/index.mobile.html",
      fixture.mockupsDir,
      [{ physical, componentPaths: ["action"] }],
    );
    assert.equal(result.html, document);
    assert.deepEqual(result.view.insertedStylesheets, active ? [span] : []);
    assert.deepEqual(
      insertedStylesheetSpans(document, result.view),
      active ? [span] : [],
    );
  });

  test(`${name}: recorded spans prove an active stylesheet`, () => {
    const usage = { insertedStylesheets: [span] };
    if (active) {
      assert.deepEqual(insertedStylesheetSpans(document, usage), [span]);
      assert.deepEqual(insertedStylesheetResources(document, usage, route), [
        "action.css",
      ]);
    } else {
      assert.throws(
        () => insertedStylesheetSpans(document, usage),
        /invalid inserted stylesheet span/,
      );
      assert.throws(
        () => insertedStylesheetResources(document, usage, route),
        /invalid inserted stylesheet span/,
      );
    }
  });
}
