import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import type { CatalogueNode } from "@mokly/viewer";

import { ancestorTitles, catalogueIndex } from "./catalogue-index";
import {
  attribute,
  byClass,
  elements,
  folderChildCount,
  label,
  repositoryRoot,
  siteDocument,
  siteStyles,
} from "./design-site-test-helpers";

const screens = [
  "design/site/home",
  "design/site/docs",
  "design/site/changelog",
  "design/site/terms",
  "design/site/privacy",
  "design/site/complaints",
  "design/site/security",
] as const;

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
  test(`${viewport}: the header band carries one header and docs-only search`, () => {
    for (const id of screens) {
      const { document } = siteDocument(id, viewport);
      const band = byClass(document, "site-band")[0];
      assert.ok(band, id);
      assert.equal(
        elements(band, (node) => node.tagName === "header").length,
        1,
      );
      assert.equal(
        elements(document, (node) => node.tagName === "header").length,
        1,
      );
      assert.equal(
        byClass(document, "site-search").length,
        id === "design/site/docs" ? 1 : 0,
      );
      assert.equal(
        (attribute(band, "class") ?? "").includes("site-band--ruled"),
        id !== "design/site/home",
      );
    }
  });

  test(`${viewport}: the footer groups all seven destinations`, () => {
    for (const id of screens) {
      const { document } = siteDocument(id, viewport);
      const footer = byClass(document, "site-footer")[0];
      assert.ok(footer);
      assert.match(
        label(byClass(footer, "site-footer-brand")[0]!),
        /MIT license/,
      );
      assert.deepEqual(byClass(footer, "site-footer-heading").map(label), [
        "Product",
        "Legal",
      ]);
      assert.equal(byClass(footer, "site-footer-link").length, 7);
    }
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

  test(`${viewport}: changelog is an indexed release list`, () => {
    const { document } = siteDocument("design/site/changelog", viewport);
    assert.deepEqual(
      byClass(document, "site-release-index-version").map(label),
      [
        "0.18.0",
        "0.17.0",
        "0.16.1",
        "0.16.0",
        "0.15.0",
        "0.14.0",
        "0.13.0",
        "0.12.0",
        "0.11.0",
        "0.10.0",
        "0.9.0",
      ],
    );
    assert.deepEqual(
      byClass(document, "site-release-index-link").map((node) =>
        attribute(node, "href"),
      ),
      [
        "#release-0-18-0",
        "#release-0-17-0",
        "#release-0-16-1",
        "#release-0-16-0",
        "#release-0-15-0",
        "#release-0-14-0",
        "#release-0-13-0",
        "#release-0-12-0",
        "#release-0-11-0",
        "#release-0-10-0",
        "#release-0-9-0",
      ],
    );
    assert.deepEqual(byClass(document, "site-badge--neutral").map(label), [
      "Mokly CLI 0.18.0",
      "Mokly CLI 0.17.0",
      "Mokly CLI 0.16.1",
      "Mokly CLI 0.16.0",
      "Mokly CLI 0.15.0",
      "Mokly CLI 0.14.0",
      "Mokly CLI 0.13.0",
      "Mokly CLI 0.12.0",
      "Mokly CLI 0.11.0",
      "Mokly CLI 0.10.0",
      "Mokly CLI 0.9.0",
    ]);
  });
}

test("split site styles own every shared composition without imports", () => {
  const css = siteStyles();
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /\.pd-/);
  for (const selector of [
    ".site-band",
    ".site-frame",
    ".site-topbar",
    ".site-tree",
    ".site-screen-head",
    ".site-stage",
    ".site-stage-frame",
    ".site-module",
    ".site-doc-tree",
    ".site-release",
    ".site-policy",
    ".site-footer-nav",
  ])
    assert.ok(css.includes(`${selector} {`), selector);
  assert.match(css, /\[data-site-viewport="mobile"\] \.site-module-grid/);
});

test("the installed package version heads only the documentation tree", () => {
  const packageVersion = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "node_modules/@mokly/mokly/package.json"),
      "utf8",
    ),
  ) as { version: string };
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = siteDocument("design/site/docs", viewport);
    assert.deepEqual(byClass(document, "site-version").map(label), [
      "Mokly CLI" + packageVersion.version,
    ]);
  }
  for (const id of screens.filter((id) => id !== "design/site/docs"))
    assert.equal(
      byClass(siteDocument(id, "desktop").document, "site-version").length,
      0,
    );
});

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
