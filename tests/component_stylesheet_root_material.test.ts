import assert from "node:assert/strict";
import test from "node:test";

import { parseHtmlLinks } from "../dist/html_links.js";
import { applyInlineMaterial } from "../dist/review/css/inline_rendering.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import {
  generatedResourcePath,
  viewRoute,
} from "../packages/viewer/dist/data.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { compareStylesheetSources } from "./helpers/component_stylesheet_comparison.js";
import { componentVariants } from "./helpers/component_views.js";
import { textOutput } from "./helpers/generated_text.js";

const source = (sheets: string[]) =>
  componentEntrySource({
    body: "<pane.Component />",
    paneRender:
      '(props) => <section>{props.children}<action.Component label="Inside" /></section>',
  })
    .replace('path: "action",', 'path: "action", stylesheets: ["action.css"],')
    .replace(
      'path: "pane",',
      `path: "pane", stylesheets: ${JSON.stringify(sheets)},`,
    );

for (const shared of [false, true])
  test(`component comparison retains only root links, including a shared declaration (${shared})`, async (t) => {
    const input = source(shared ? ["pane.css", "action.css"] : ["pane.css"]);
    const { after } = await compareStylesheetSources(t, input, input);
    const variant = componentVariants(after.manifest, "pane")[0]!;
    const view = variant.componentViews[0]!;
    const html = textOutput(
      after.outputs,
      viewRoute(variant.path, "mobile", "light"),
    )!;
    const child = view.insertedStylesheets!.find(
      (span) => span.path === "action.css",
    )!;
    assert.deepEqual(
      child.componentPaths,
      shared ? ["action", "pane"] : ["action"],
    );
    const page = new PageAnalysis(
      html,
      generatedResourcePath(viewRoute(variant.path, "mobile", "light")),
      view,
    );
    const material = {
      html: applyInlineMaterial(html, {
        replacements: page.stylesheetEdits("pane"),
        appendix: "",
      }),
    };
    assert.deepEqual(
      parseHtmlLinks(material.html).links.map((link) =>
        link.attributes.get("href"),
      ),
      shared
        ? ["../../../pane.css", "../../../action.css"]
        : ["../../../pane.css"],
    );
    assert.match(material.html, /Inside/);
  });

test("reordering root links changes component material on complete and fast paths", async (t) => {
  const { result } = await compareStylesheetSources(
    t,
    source(["pane.css", "base.css", "action.css"]),
    source(["base.css", "pane.css", "action.css"]),
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    ["pane"],
  );
  const pane = result.components.find((entry) => entry.path === "pane")!;
  assert.ok(pane.variants.length > 0);
  for (const variant of pane.variants) {
    assert.ok(variant.views.length > 0);
    assert.ok(variant.views.every((view) => view.material));
  }
});
