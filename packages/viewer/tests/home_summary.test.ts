import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { homeSummary } from "../src/shell/home_summary.js";
import { renderViewer } from "../src/viewer/server.js";

const model = () =>
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v5.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );

/** The summary line the home page renders, or undefined without one. */
function homeNote(catalogue: unknown): string | undefined {
  const html = renderViewer({
    viewerId: "home",
    catalogue: catalogue as Parameters<typeof renderViewer>[0]["catalogue"],
    baseUrl: "https://catalogue.example",
  });
  return /<p class="mbk-empty-note">([^<]*)<\/p>/u.exec(
    html.replaceAll("<!-- -->", ""),
  )?.[1];
}

test("home counts every current entry kind, documents included", () => {
  assert.equal(
    homeNote(model()),
    "3 screens · 2 components · 1 user flow · 1 catalogue page · 1 document",
  );
});

test("home omits kinds with no current entries", () => {
  const documentsOnly = model();
  documentsOnly.screens = [];
  documentsOnly.components = [];
  documentsOnly.pages = [];
  documentsOnly.useCases = [];
  documentsOnly.removedEntries = [];
  documentsOnly.tree = documentsOnly.tree
    .filter((node: { path: string }) => node.path === "product")
    .map((node: { children: unknown[] }) => ({
      ...node,
      children: [node.children[0]],
    }));
  assert.equal(homeNote(documentsOnly), "1 document");
});

test("the summary lists kinds in order, says one entry in the singular, and needs entries", () => {
  const entries = (...kinds: string[]) =>
    kinds.map((kind) => ({ kind })) as Parameters<typeof homeSummary>[0];
  assert.equal(
    homeSummary(entries("document", "component", "component", "screen")),
    "1 screen · 2 components · 1 document",
  );
  assert.equal(
    homeSummary(entries("use-case", "page")),
    "1 user flow · 1 catalogue page",
  );
  assert.equal(homeSummary([]), undefined);
});
