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
import { rewriteStage } from "../scripts/stage/fragments.js";
import { CHANGELOG_FILE } from "../src/changelog/releases.js";
import { settings } from "../src/settings.js";
import {
  parseStageManifest,
  readStageManifest,
  stageDocumentFor,
  stageDocumentPath,
} from "../src/stage.js";
import { sitePath } from "../src/workspace.js";

const ENTRIES: readonly CatalogueEntry[] = [
  {
    childIds: ["screens", "parts"],
    id: "example",
    kind: "collection",
    title: "Example",
  },
  {
    childIds: ["welcome"],
    id: "screens",
    kind: "collection",
    navPath: ["Example"],
    title: "Screens",
  },
  {
    id: "welcome",
    kind: "screen",
    navPath: ["Example", "Screens"],
    route: "screens/welcome.html",
    title: "Welcome",
  },
  {
    childIds: ["action"],
    id: "parts",
    kind: "collection",
    navPath: ["Example"],
    title: "Parts",
  },
  {
    id: "action",
    kind: "component",
    navPath: ["Example", "Parts"],
    route: "components/action.html",
    title: "Action",
  },
];

function fragment(name: string, body: string): string {
  return `<!doctype html><html lang="en"><head><title>Welcome</title><link rel="stylesheet" href="../styles.css"></head><body><main id="welcome">${body}</main><!-- ${name} --></body></html>`;
}

test("the configured stage pull request is one this repository merged", () => {
  const changelog = readFileSync(CHANGELOG_FILE, "utf8");
  assert.ok(
    changelog.includes(`#${settings.stagePr}`),
    `SITE_STAGE_PR=${settings.stagePr} names no pull request in CHANGELOG.md`,
  );
});

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
  assert.ok(html.includes('href="./welcome.desktop.html"'));
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(!html.includes("details.desktop.html"));
  assert.ok(html.includes(">Details</a>"), "the text of a dropped link stays");
  assert.deepEqual(
    [...rewritten.resources],
    [["styles.css", "styles.css"]],
    "the stylesheet is published beside the document",
  );
  assert.equal(rewritten.title, "Welcome");
  assert.equal(rewritten.screenId, "welcome");
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
    /title and a main element/,
  );
});

test("the depicted catalogue expands the branch holding the screen", () => {
  const screen = stagedEntry(ENTRIES, "screens/welcome.html");
  assert.deepEqual(catalogueTrail(screen), [
    CATALOGUE_ROOT,
    "Example",
    "Screens",
  ]);
  assert.deepEqual(catalogueSections(ENTRIES, screen), [
    {
      rows: [
        {
          count: 2,
          current: false,
          depth: 0,
          kind: "collection",
          label: "Example",
        },
        {
          count: 1,
          current: false,
          depth: 1,
          kind: "collection",
          label: "Screens",
        },
        {
          count: null,
          current: true,
          depth: 2,
          kind: "screen",
          label: "Welcome",
        },
      ],
      title: "Pages",
    },
    {
      rows: [
        {
          count: 2,
          current: false,
          depth: 0,
          kind: "collection",
          label: "Example",
        },
        {
          count: 1,
          current: false,
          depth: 1,
          kind: "collection",
          label: "Parts",
        },
        {
          count: null,
          current: false,
          depth: 2,
          kind: "component",
          label: "Action",
        },
      ],
      title: "Components",
    },
  ]);
});

test("a screen the catalogue does not publish cannot be staged", () => {
  assert.throws(() => stagedEntry(ENTRIES, "screens/absent.html"), /no screen/);
});

test("the depicted navigation is bounded to one screenful", () => {
  const screen = stagedEntry(ENTRIES, "screens/welcome.html");
  for (const section of catalogueSections(ENTRIES, screen, 2)) {
    assert.ok(section.rows.length <= 2, section.title);
  }
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
  for (const viewport of ["desktop", "mobile"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const document = stageDocumentFor(manifest, viewport, scheme);
      const html = readFileSync(
        path.join(dist, stageDocumentPath(document).slice(1)),
        "utf8",
      );
      assert.match(html, /<title>Welcome<\/title>/);
      assert.match(html, /Welcome to Mokly/);
      assert.match(html, new RegExp(`data-color-scheme="${scheme}"`));
    }
  }
  assert.ok(manifest.resources.length > 0);
  for (const resource of manifest.resources) {
    assert.ok(
      readFileSync(path.join(dist, "stage", resource), "utf8").length > 0,
      resource,
    );
  }
});
