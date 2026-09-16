import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";

const HOME = "design-site-home";
const DOCS = "design-site-docs";
const CHANGELOG = "design-site-changelog";
const TERMS = "design-site-terms";
const PRIVACY = "design-site-privacy";

const SCREENS = [HOME, DOCS, CHANGELOG, TERMS, PRIVACY];

const FOOTER_GROUPS = ["Product", "Account", "Legal"];

const FOOTER_LINKS = [
  "Home",
  "Docs",
  "Changelog",
  "Sign in",
  "Get started",
  "Terms",
  "Privacy",
];

const MODULE_LABELS = ["BROWSE", "REVIEW", "EDIT"];

const STEPS = [
  "Shape the next screen.",
  "Publish the branch.",
  "Build from a shared decision.",
];

const COMPARE_LINKS = [
  "https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0",
  "https://github.com/futex-ai/mokabook/compare/v0.7.1...v0.8.0",
  "https://github.com/futex-ai/mokabook/compare/v0.7.0...v0.7.1",
];

function label(node: Parameters<typeof textContent>[0]): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the header band carries one header row and no utility bar`, async () => {
    for (const id of SCREENS) {
      const { document } = await designDocument(id, viewport);
      const band = byClass(document, "site-band")[0];
      assert.ok(band, `${id}: missing the header band`);
      assert.ok(byClass(band, "site-header")[0], id);
      assert.equal(
        (attribute(band, "class") ?? "")
          .split(/\s+/)
          .includes("site-band--ruled"),
        id !== "design-site-home",
        `${id}: only structured pages rule the band off`,
      );
      assert.equal(
        elements(band, (node) => node.tagName === "header").length,
        1,
        `${id}: the band holds the header alone`,
      );
      assert.equal(
        elements(document, (node) => node.tagName === "header").length,
        1,
        `${id}: the page carries no second header row`,
      );
      assert.equal(
        byClass(document, "site-search").length,
        id === DOCS ? 1 : 0,
        `${id}: search belongs to the documentation header`,
      );
    }
  });

  test(`${viewport}: the footer groups the seven destinations into columns`, async () => {
    for (const id of SCREENS) {
      const { document } = await designDocument(id, viewport);
      const footer = byClass(document, "site-footer")[0];
      assert.ok(footer, id);
      assert.match(
        label(byClass(footer, "site-footer-brand")[0]!),
        /open source under the MIT license/,
        `${id}: the footer states the license`,
      );
      const groups = byClass(footer, "site-footer-group");
      assert.equal(groups.length, 3, `${id}: three footer columns`);
      assert.deepEqual(
        groups.map((group) => label(byClass(group, "site-footer-heading")[0]!)),
        FOOTER_GROUPS,
        id,
      );
      const nav = byClass(footer, "site-footer-nav")[0];
      assert.ok(nav);
      const links = elements(nav, (node) => node.tagName === "a");
      assert.deepEqual(links.map(label), FOOTER_LINKS, id);
      assert.equal(
        byClass(nav, "site-footer-link").length,
        FOOTER_LINKS.length,
        `${id}: every footer link carries the hoverable class`,
      );
    }
  });

  test(`${viewport}: the home frames the catalogue shell around the Welcome screen`, async () => {
    const { document } = await designDocument(HOME, viewport);
    const frame = byClass(document, "site-frame")[0];
    assert.ok(frame, "the home renders the catalogue frame");
    assert.equal(
      label(byClass(frame, "site-frame-head")[0]!),
      "Pull request #71Ready for review",
    );
    assert.equal(byClass(frame, "site-badge-dot").length, 1);
    assert.equal(label(byClass(frame, "site-frame-foot")[0]!), "ScreenWelcome");

    const topBar = byClass(frame, "site-topbar")[0];
    assert.ok(topBar, "the frame shows the shell's top bar");
    assert.match(label(topBar), /Search catalogue/);
    assert.equal(byClass(topBar, "site-topbar-mark").length, 1);
    assert.equal(
      byClass(topBar, "site-topbar-menu").length,
      viewport === "mobile" ? 1 : 0,
      "the menu control belongs to the mobile shell",
    );

    const head = byClass(frame, "site-screen-head")[0];
    assert.ok(head);
    assert.equal(
      label(byClass(head, "site-crumbs")[0]!),
      "Catalogue home›Example›Screens",
    );
    assert.equal(label(byClass(head, "site-screen-title")[0]!), "Welcome");
    assert.equal(label(byClass(head, "site-idchip")[0]!), "#welcome");

    const stage = byClass(frame, "site-stage")[0];
    assert.ok(stage);
    assert.equal(label(byClass(stage, "site-stage-label")[0]!), "Desktop");
    const shot = byClass(stage, "site-shot")[0];
    assert.ok(shot, "the stage holds the Welcome screen in a browser frame");
    assert.equal(
      label(byClass(shot, "site-shot-address")[0]!),
      "example.test/welcome",
    );
    assert.match(label(shot), /Welcome to Mokly/);
  });

  test(`${viewport}: the home navigation depicts the Pages and Components sections`, async () => {
    const { document } = await designDocument(HOME, viewport);
    const tree = byClass(document, "site-tree")[0];
    if (viewport === "mobile") {
      assert.equal(tree, undefined, "the mobile shell hides the tree");
      return;
    }
    assert.ok(tree);
    assert.deepEqual(byClass(tree, "site-tree-section-head").map(label), [
      "Pages",
      "Components",
    ]);
    assert.deepEqual(byClass(tree, "site-filter-option").map(label), [
      "All",
      "Changes3",
    ]);
    assert.equal(
      label(byClass(tree, "site-filter-option--current")[0]!),
      "All",
      "All is the quiet filled current filter",
    );
    const current = byClass(tree, "site-row--current");
    assert.equal(current.length, 1);
    assert.equal(label(current[0]!), "Welcome");
    const depths = byClass(tree, "site-row").map((row) =>
      attribute(row, "data-site-depth"),
    );
    assert.deepEqual([...new Set(depths)].sort(), ["0", "1", "2"]);
  });

  test(`${viewport}: the home modules pair the feature copy with a shell detail`, async () => {
    const { document } = await designDocument(HOME, viewport);
    const modules = byClass(document, "site-module");
    assert.equal(modules.length, 3);
    assert.deepEqual(
      modules.map((module) => attribute(module, "id")),
      ["browse", "review", "edit"],
    );
    assert.deepEqual(
      modules.map((module) => label(byClass(module, "site-feature-label")[0]!)),
      MODULE_LABELS,
    );
    for (const module of modules)
      assert.equal(
        byClass(module, "site-detail").length,
        1,
        "every module frames one shell detail",
      );
    const [browse, review, edit] = modules;
    assert.match(
      label(byClass(browse!, "site-filter")[0]!),
      /All\s*Changes\s*3/,
    );
    assert.equal(byClass(review!, "site-pin").length, 2);
    assert.match(label(byClass(review!, "site-comment")[0]!), /Comment/);
    assert.match(
      label(byClass(review!, "site-comment-approve")[0]!),
      /Approve/,
    );
    assert.match(label(byClass(edit!, "site-agent")[0]!), /Agent session/);
    assert.match(label(byClass(edit!, "site-agent-input")[0]!), /Describe/);
    const steps = byClass(document, "site-step");
    assert.deepEqual(
      steps.map((step) =>
        label(elements(step, (node) => node.tagName === "h3")[0]!),
      ),
      STEPS,
    );
    assert.equal(byClass(document, "site-actions").length, 2);
  });

  test(`${viewport}: the changelog reads as an indexed Changes list`, async () => {
    const { document, html } = await designDocument(CHANGELOG, viewport);
    assert.equal(
      label(byClass(document, "site-trail")[0]!),
      "Changelog",
      "the location trail is the eyebrow above the title",
    );
    const index = byClass(document, "site-release-index")[0];
    assert.ok(index, "the changelog carries a release index");
    assert.deepEqual(byClass(index, "site-release-index-version").map(label), [
      "0.9.0",
      "0.8.0",
      "0.7.1",
    ]);
    assert.deepEqual(
      elements(index, (node) => node.tagName === "a").map((node) =>
        attribute(node, "href"),
      ),
      ["#release-0-9-0", "#release-0-8-0", "#release-0-7-1"],
    );
    const releases = byClass(document, "site-release");
    assert.equal(releases.length, 3);
    assert.deepEqual(
      releases.map((release) =>
        label(byClass(release, "site-badge--neutral")[0]!),
      ),
      ["Mokly CLI 0.9.0", "Mokly CLI 0.8.0", "Mokly CLI 0.7.1"],
    );
    assert.deepEqual(
      releases.map((release) =>
        attribute(
          elements(release, (node) => node.tagName === "time")[0]!,
          "datetime",
        ),
      ),
      ["2026-09-15", "2026-09-11", "2026-09-11"],
    );
    assert.deepEqual(
      releases.map((release) =>
        attribute(byClass(release, "site-release-link")[0]!, "href"),
      ),
      COMPARE_LINKS,
    );
    assert.deepEqual(
      byClass(releases[0]!, "site-release-group-head").map(label),
      ["Breaking changes", "Features", "Bug fixes"],
    );
    assert.deepEqual(
      byClass(releases[1]!, "site-release-group-head").map(label),
      ["Features", "Bug fixes", "Performance"],
    );
    assert.match(html, /Split catalogue navigation into sections/);
    assert.match(html, /Start large catalogues with on-demand previews/);
  });

  test(`${viewport}: both policies read as the site's document column`, async () => {
    for (const id of [TERMS, PRIVACY]) {
      const { document } = await designDocument(id, viewport);
      const main = byClass(document, "site-policy")[0];
      assert.ok(main, `${id}: the policy uses the document column`);
      assert.equal(main.tagName, "main");
      assert.equal(attribute(main, "id"), "main");
      const intro = byClass(main, "site-document-intro")[0];
      assert.ok(intro, id);
      assert.equal(label(byClass(intro, "site-eyebrow")[0]!), "Using Mokly");
      assert.equal(byClass(main, "site-policy-empty").length, 1, id);
    }
  });
}

test("the site stylesheet is self-contained and owns the whole chrome", async () => {
  const stylesheet = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/generated/site.css"),
    "utf8",
  );
  assert.doesNotMatch(
    stylesheet,
    /@import/,
    "the baseline sheet stands on its own",
  );
  assert.doesNotMatch(
    stylesheet,
    /\.pd-/,
    "every class carries the site- prefix",
  );
  for (const selector of [
    ".site-band",
    ".site-trail",
    ".site-frame",
    ".site-topbar",
    ".site-tree",
    ".site-screen-head",
    ".site-stage",
    ".site-module",
    ".site-doc-tree",
    ".site-release",
    ".site-policy",
    ".site-footer-nav",
  ])
    assert.ok(
      stylesheet.includes(`${selector} {`),
      `site.css defines ${selector}`,
    );
  assert.match(
    stylesheet,
    /\[data-site-viewport="mobile"\] \.site-module-grid/,
    "the mobile composition collapses the module grid",
  );
});

test("the depicted version heads the documentation tree", async () => {
  const changelog = await fs.readFile(
    path.join(repositoryRoot, "CHANGELOG.md"),
    "utf8",
  );
  const latest = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog)?.[1];
  assert.ok(latest);
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = await designDocument(DOCS, viewport);
    const version = byClass(document, "site-version");
    assert.equal(version.length, 1, viewport);
    assert.equal(
      label(version[0]!),
      `Mokly CLI${latest}`,
      "the tree heads with the published Mokly CLI version",
    );
  }
  for (const id of [HOME, CHANGELOG, TERMS, PRIVACY]) {
    const { document } = await designDocument(id, "desktop");
    assert.equal(
      byClass(document, "site-version").length,
      0,
      `${id}: the version chip belongs to the documentation tree`,
    );
  }
});
