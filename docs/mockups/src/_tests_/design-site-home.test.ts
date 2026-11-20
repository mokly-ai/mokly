import assert from "node:assert/strict";
import { dirname, relative } from "node:path";
import { test } from "node:test";

import type { CatalogueNode } from "@mokly/viewer";

import { openSource, siteStage } from "../fixtures/site";

import { ancestorTitles, catalogueIndex } from "./catalogue-index";
import { screenView } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  folderChildCount,
  label,
  siteDocument,
  siteEntry,
  siteStyles,
} from "./design-site-test-helpers";

/** The hero's one-line heading and lead, in reading order. */
const hero = [
  "Mockup your entire app.",
  "Prevent AI slop and accidental clobbers, by codifying your design and forcing agents to align their implementation with it.",
];

const features = [
  "See every branch as screens.",
  "Comment on the screen itself.",
  "Ask for the change beside the screen.",
];

const steps = [
  "Shape the next screen.",
  "Publish the branch.",
  "Build from a shared decision.",
];

type FolderNode = Extract<CatalogueNode, { kind: "folder" }>;

/** The folder node at one path of an index tree, or nothing. */
function findFolder(
  nodes: readonly CatalogueNode[],
  path: string,
): FolderNode | undefined {
  for (const node of nodes) {
    if (node.kind === "folder" && node.path === path) return node;
    const found = findFolder(node.children ?? [], path);
    if (found) return found;
  }
  return undefined;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: home carries the approved copy and real dogfood stage`, () => {
    const { document, html, route } = siteDocument(
      "design/site/home",
      viewport,
    );
    const text = label(document);
    for (const line of [...hero, ...features, ...steps])
      assert.ok(text.includes(line), `missing home copy: ${line}`);
    const intro = byClass(document, "site-hero")[0];
    assert.ok(intro);
    assert.deepEqual(
      elements(intro, (node) => ["h1", "p"].includes(node.tagName)).map(label),
      hero,
      "the hero carries only its heading and lead",
    );
    for (const actions of byClass(document, "site-actions")) {
      const links = elements(actions, (node) => node.tagName === "a");
      assert.deepEqual(links.map(label), ["Get started →", "View on GitHub"]);
      assert.equal(attribute(links[0]!, "data-mokly-link"), "design/site/docs");
      assert.equal(attribute(links[1]!, "href"), openSource.github);
    }
    assert.deepEqual(byClass(document, "site-feature-label").map(label), [
      "BROWSE",
      "REVIEW",
      "EDIT",
    ]);

    const frame = byClass(document, "site-frame")[0];
    assert.ok(frame);
    assert.equal(
      label(byClass(frame, "site-frame-head")[0]!),
      siteStage.label + siteStage.status,
    );
    const depicted = siteEntry("product/account/project-created");
    assert.equal(depicted.kind, "screen");
    if (depicted.kind !== "screen") return;
    assert.equal(
      label(byClass(frame, "site-frame-foot")[0]!),
      "Screen" + depicted.title,
    );
    assert.equal(
      label(byClass(frame, "site-screen-title")[0]!),
      depicted.title,
    );
    assert.equal(
      label(byClass(frame, "site-idchip")[0]!),
      "#product/account/project-created",
    );

    const frames = elements(frame, (node) => node.tagName === "iframe");
    assert.equal(frames.length, 2);
    for (const [index, scheme] of [
      [0, "light"],
      [1, "dark"],
    ] as const) {
      const child = frames[index]!;
      assert.equal(
        attribute(child, "sandbox"),
        "allow-same-origin allow-scripts",
      );
      assert.equal(attribute(child, "tabindex"), "-1");
      // Each frame opens the depicted screen's own document in this viewport
      // and scheme, addressed from the home document.
      assert.equal(
        attribute(child, "src"),
        relative(
          dirname(route),
          screenView("product/account/project-created", viewport, scheme),
        ),
      );
    }
    assert.doesNotMatch(
      html,
      /Pull request #|Welcome to Mokly|github\.com\/mokly-cloud/,
    );
  });

  test(`${viewport}: the stage chrome names the real catalogue hierarchy`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const frame = byClass(document, "site-frame")[0];
    assert.ok(frame);
    assert.match(label(byClass(frame, "site-topbar")[0]!), /Search catalogue/);
    assert.equal(
      byClass(frame, "site-topbar-menu").length,
      viewport === "mobile" ? 1 : 0,
    );
    assert.deepEqual(
      byClass(frame, "site-crumb").map((node) => label(node).replace(/^›/, "")),
      ancestorTitles("product/account/project-created"),
    );

    const tree = byClass(frame, "site-tree")[0];
    if (viewport === "mobile") {
      assert.equal(tree, undefined);
      return;
    }
    assert.ok(tree);
    assert.deepEqual(byClass(tree, "site-tree-section-head").map(label), [
      "Specs",
      "Components",
    ]);
    assert.equal(byClass(tree, "site-filter").length, 0);
    assert.deepEqual(byClass(tree, "site-row--current").map(label), [
      "Project created",
    ]);
    assert.deepEqual(byClass(tree, "site-row-count").map(label), [
      String(folderChildCount("pages", ["Product"])),
      String(folderChildCount("pages", ["Product", "Account"])),
      String(folderChildCount("components", ["Design"])),
    ]);
  });

  test(`${viewport}: home modules and closing retain their structure`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const modules = byClass(document, "site-module");
    assert.equal(modules.length, 3);
    assert.deepEqual(
      modules.map((module) => attribute(module, "id")),
      ["browse", "review", "edit"],
    );
    for (const module of modules)
      assert.equal(byClass(module, "site-detail").length, 1);
    assert.equal(byClass(modules[1]!, "site-pin").length, 2);
    assert.match(
      label(byClass(modules[2]!, "site-agent")[0]!),
      /Agent session/,
    );
    assert.deepEqual(
      byClass(document, "site-step").map((step) =>
        label(elements(step, (node) => node.tagName === "h3")[0]!),
      ),
      [
        "Shape the next screen.",
        "Publish the branch.",
        "Build from a shared decision.",
      ],
    );
    assert.equal(byClass(document, "site-actions").length, 2);
  });
}

test("breadcrumb parity detects a changed ancestor title", () => {
  const { document } = siteDocument("design/site/home", "desktop");
  const crumbs = byClass(document, "site-crumb").map((node) =>
    label(node).replace(/^›/, ""),
  );
  const changed = structuredClone(catalogueIndex());
  const account = findFolder(changed.tree, "product/account");
  assert.ok(account);
  account.title = "Changed account title";
  assert.throws(
    () =>
      assert.deepEqual(
        crumbs,
        ancestorTitles("product/account/project-created", changed),
      ),
    { name: "AssertionError" },
  );
});

test("split site styles own the home compositions", () => {
  const css = siteStyles();
  for (const selector of [
    ".site-frame",
    ".site-topbar",
    ".site-tree",
    ".site-screen-head",
    ".site-stage",
    ".site-stage-frame",
    ".site-module",
  ])
    assert.ok(css.includes(`${selector} {`), selector);
  assert.match(css, /\[data-site-viewport="mobile"\] \.site-module-grid/);
});
