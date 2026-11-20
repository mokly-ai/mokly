import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { serialize } from "parse5";

import { currentDocumentPath, viewRoute } from "@mokly/viewer/data";

import { cssReferences } from "../scripts/links/documents.js";
import {
  CATALOGUE_ROOT,
  type CatalogueEntry,
  catalogueSections,
  catalogueTrail,
  stagedEntry,
} from "../scripts/stage/catalogue.js";
import { INLINED_STYLESHEET_ATTRIBUTE } from "../scripts/stage/stylesheets.js";
import {
  parseStageManifest,
  readStageManifest,
  stageDocumentFor,
  stageDocumentPath,
} from "../src/stage.js";
import { repositoryPath, sitePath } from "../src/workspace.js";

import { documentStyles } from "./helpers/stage-styles.js";

const ENTRIES: readonly CatalogueEntry[] = [
  { path: "example/screens/welcome", kind: "screen", title: "Welcome" },
  {
    path: "example/screens/welcome/empty",
    kind: "screen",
    title: "Empty",
    variantOf: "example/screens/welcome",
  },
  { path: "example/tour", kind: "use-case", title: "Tour" },
  { path: "example/parts/action", kind: "component", title: "Action" },
  {
    path: "example/parts/action/default",
    kind: "component",
    title: "Default",
    variantOf: "example/parts/action",
  },
];

const TREE = {
  tree: [
    {
      kind: "folder" as const,
      path: "example",
      title: "Example",
      children: [
        {
          kind: "folder" as const,
          path: "example/screens",
          title: "Screens",
          children: [
            {
              kind: "entry" as const,
              path: "example/screens/welcome",
              children: [
                {
                  kind: "entry" as const,
                  path: "example/screens/welcome/empty",
                },
              ],
            },
          ],
        },
        {
          kind: "folder" as const,
          path: "example/parts",
          title: "Parts",
          children: [
            {
              kind: "entry" as const,
              path: "example/parts/action",
              children: [
                {
                  kind: "entry" as const,
                  path: "example/parts/action/default",
                },
              ],
            },
          ],
        },
        { kind: "entry" as const, path: "example/tour" },
      ],
    },
  ],
};

test("a screen the catalogue does not publish cannot be staged", () => {
  assert.throws(() => stagedEntry(ENTRIES, "absent"), /no screen/);
  assert.throws(
    () => stagedEntry(ENTRIES, "example/screens/welcome/empty"),
    /no screen/,
  );
  assert.throws(
    () => stagedEntry(ENTRIES, "example/parts/action"),
    /no screen/,
  );
});

test("a tight component bound still keeps the selected screen visible", () => {
  const screen = stagedEntry(ENTRIES, "example/screens/welcome");
  const sections = catalogueSections(ENTRIES, TREE, screen, 2);
  assert.ok(sections[0]?.rows.some((row) => row.current));
  assert.ok((sections[1]?.rows.length ?? 0) <= 2);
  assert.deepEqual(catalogueTrail(ENTRIES, TREE, screen), [
    CATALOGUE_ROOT,
    "Example",
    "Screens",
  ]);
});

test("a manifest that does not describe a complete stage is rejected", () => {
  assert.throws(() => parseStageManifest({}), /manifest is invalid/);
  assert.throws(
    () => parseStageManifest({ ...readStageManifest(), documents: [] }),
    /documents/,
  );
});

test("the build published every screen document and its resources", () => {
  const manifest = readStageManifest();
  const dist = sitePath("dist");
  const font =
    "static/mokly-generated/assets/docs/mockups/styles/fonts/InterVariable.woff2";
  assert.equal(manifest.documents.length, 4);
  assert.equal(manifest.screen, "Project created");
  assert.equal(manifest.screenPath, "product/account/project-created");
  assert.ok(
    manifest.sections.some((section) =>
      section.rows.some(
        (row) =>
          row.current &&
          row.kind === "screen" &&
          row.label === "Project created",
      ),
    ),
    "the projected navigation keeps the staged screen visible",
  );
  for (const viewport of ["desktop", "mobile"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const document = stageDocumentFor(manifest, viewport, scheme);
      const html = readFileSync(
        path.join(dist, stageDocumentPath(document).slice(1)),
        "utf8",
      );
      assert.match(html, /<title>Project created<\/title>/);
      assert.match(html, /Mokly Cloud is ready/);
      assert.match(html, new RegExp(`data-color-scheme="${scheme}"`));
      const { head, links, styles } = documentStyles(html);
      assert.deepEqual(links, [], `${document.file} loads a stylesheet link`);
      const css = styles.map((style) => serialize(style)).join("\n");
      assert.doesNotMatch(css, /@import\b/i, `${document.file} uses @import`);

      const sourcePath = currentDocumentPath(
        viewRoute(manifest.screenPath, viewport, scheme),
      );
      const source = readFileSync(
        repositoryPath("mokly-static", sourcePath),
        "utf8",
      );
      const expected = documentStyles(source).head.map((element) =>
        element.tagName === "link"
          ? "inlined stylesheet"
          : { text: serialize(element) },
      );
      const published = head.map((style) => {
        const text = serialize(style);
        const marked = style.attrs.some(
          ({ name }) => name === INLINED_STYLESHEET_ATTRIBUTE,
        );
        if (!marked) return { text };
        return text.trim() ? "inlined stylesheet" : "empty stylesheet";
      });
      assert.deepEqual(
        published,
        expected,
        `${document.file} head styles differ from the source`,
      );

      const faces = css.match(/@font-face\s*\{[^}]*\}/gi) ?? [];
      assert.ok(
        faces.some((face) => cssReferences(face).includes(`./${font}`)),
        `${document.file} has no inline @font-face for InterVariable.woff2`,
      );
    }
  }
  assert.ok(manifest.resources.includes(font));
  assert.ok(
    manifest.resources.some((resource) => resource.includes("/")),
    "nested catalogue resources retain their paths",
  );
  for (const resource of manifest.resources) {
    assert.ok(
      readFileSync(path.join(dist, "stage", resource), "utf8").length > 0,
      resource,
    );
  }
});
