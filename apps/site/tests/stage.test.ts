import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  CATALOGUE_ROOT,
  type CatalogueEntry,
  catalogueSections,
  catalogueTrail,
  stagedEntry,
} from "../scripts/stage/catalogue.js";
import {
  rewriteStage,
  stylesheetResources,
} from "../scripts/stage/fragments.js";
import {
  parseStageManifest,
  readStageManifest,
  stageDocumentFor,
  stageDocumentPath,
} from "../src/stage.js";
import { sitePath } from "../src/workspace.js";

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

function fragment(name: string, body: string): string {
  return `<!doctype html><html lang="en"><head><title>Welcome</title><link rel="stylesheet" href="../styles.css"><script src="/mokly-viewer/client/frame-probe.js"></script></head><body><main id="welcome">${body}</main><!-- ${name} --></body></html>`;
}

test("resources move beside the document and unpublished links are dropped", () => {
  const rewritten = rewriteStage(
    new Map([
      [
        "welcome.desktop.html",
        {
          html: fragment(
            "desktop",
            '<a href="./details.desktop.html#details">Details</a><a href="./welcome.desktop.html">Self</a><a href="https://example.com/">Away</a>',
          ),
          path: "screens/welcome.desktop.html",
        },
      ],
    ]),
  );
  const html = rewritten.documents.get("welcome.desktop.html") ?? "";
  assert.ok(html.includes('href="./styles.css"'));
  assert.ok(html.includes('src="./mokly-viewer/client/frame-probe.js"'));
  assert.ok(html.includes('href="./welcome.desktop.html"'));
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(!html.includes("details.desktop.html"));
  assert.ok(html.includes(">Details</a>"), "the text of a dropped link stays");
  assert.deepEqual(
    [...rewritten.resources],
    [
      ["styles.css", "styles.css"],
      [
        "mokly-viewer/client/frame-probe.js",
        "mokly-viewer/client/frame-probe.js",
      ],
    ],
    "the stylesheet is published beside the document",
  );
  assert.equal(rewritten.title, "Welcome");
});

test("stylesheet resources include imports and nested URLs", () => {
  assert.deepEqual(
    stylesheetResources(
      "styles/product/inventory.css",
      '@import "account.css";\n@import url("records.css");\n.card { background-image: url(../art/card.svg#mark); }',
    ),
    [
      "styles/product/account.css",
      "styles/product/records.css",
      "styles/art/card.svg",
    ],
  );
});

test("a resource the stage cannot publish fails the build", () => {
  assert.throws(
    () =>
      rewriteStage(
        new Map([
          [
            "welcome.desktop.html",
            {
              html: '<html><head><title>Welcome</title></head><body><main id="welcome"><img srcset="../a.png 1x"></main></body></html>',
              path: "screens/welcome.desktop.html",
            },
          ],
        ]),
      ),
    /responsive source/,
  );
  assert.throws(
    () =>
      rewriteStage(
        new Map([
          [
            "welcome.desktop.html",
            {
              html: '<html><head><title>Welcome</title><style>p{background:url(../art.png)}</style></head><body><main id="welcome"></main></body></html>',
              path: "screens/welcome.desktop.html",
            },
          ],
        ]),
      ),
    /embedded stylesheet reference/,
  );
});

test("a document without a titled screen fails the build", () => {
  assert.throws(
    () =>
      rewriteStage(
        new Map([
          [
            "welcome.desktop.html",
            { html: "<html><body></body></html>", path: "a.html" },
          ],
        ]),
      ),
    /title and a main landmark/,
  );
});

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
    }
  }
  assert.ok(
    manifest.resources.includes(
      "static/mokly-generated/assets/docs/mockups/styles/fonts/Geist-Variable.woff2",
    ),
  );
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
