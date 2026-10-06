import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { viewRoute } from "../packages/viewer/dist/data.js";

import { entriesUnder } from "./helpers/catalogue_selection.js";
import {
  attribute,
  byClass,
  designCatalogue,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("every design artboard with a rendered document links the document stylesheet", async () => {
  const { manifest, outputs } = await designCatalogue;
  let documents = 0;
  for (const entry of entriesUnder(manifest, "design", { kind: "screen" })) {
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of entry.colorSchemes) {
        const route = viewRoute(entry.path, viewport, scheme);
        const html = textOutput(outputs, route);
        assert.ok(html, route);
        const document = parse(html);
        if (byClass(document, "mbk-markdown").length === 0) continue;
        documents += 1;
        const sheets = elements(
          document,
          (node) =>
            node.tagName === "link" && attribute(node, "rel") === "stylesheet",
        ).map((node) => attribute(node, "href") ?? "");
        assert.ok(
          sheets.some((href) => href.endsWith("design-documents.css")),
          `${route} renders a document without design-documents.css`,
        );
      }
  }
  assert.ok(documents > 0, "no design renders a document");
});
