import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import { openSource } from "../fixtures/site";

import {
  codePanels,
  installedGuide,
  installedVersion,
  one,
  tags,
  type Root,
} from "./design-site-docs-helpers";
import {
  attribute,
  byClass,
  childElements,
  label,
  repositoryRoot,
  siteDocument,
} from "./design-site-test-helpers";

/** The two guides that the documentation draws, and what the site says. */
const pages = [
  {
    entry: "design/site/docs",
    file: "start/install.md",
    ids: [
      "install-the-package",
      "run-the-command",
      "pin-a-version",
      "what-you-need",
      "next",
    ],
    pager: ["Getting started", "Configure"],
    title: "Install",
  },
  {
    entry: "design/site/docs/first-screen",
    file: "start/your-first-screen.md",
    ids: [
      "add-one-html-file",
      "validate-the-catalogue",
      "open-the-catalogue",
      "start-with-a-react-screen",
      "use-your-product-components",
      "find-the-screen",
      "browse-and-build",
    ],
    pager: ["Configure", "Build"],
    title: "Your first screen",
  },
] as const;

/** Each property of the page: its label and its value. */
function facts(root: Root) {
  return byClass(root, "site-docs-fact").map((fact) =>
    childElements(fact).map(label),
  );
}

/**
 * Edit on GitHub opens the guide's own source, `docs/guides/{file}`, on the
 * main branch, and that path is a file that Git tracks.
 */
function editLink(root: Root, file: string) {
  const link = one(root, "site-docs-edit");
  assert.equal(label(link), "Edit on GitHub");
  assert.equal(attribute(link, "data-mokly-link"), undefined);
  const href = attribute(link, "href") ?? "";
  const edit = `${openSource.github}/edit/main/`;
  assert.ok(href.startsWith(edit), href);
  const source = href.slice(edit.length);
  assert.equal(source, `docs/guides/${file}`);
  const tracked = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", source],
    { cwd: repositoryRoot, encoding: "utf8", env: fixtureGitEnvironment() },
  );
  assert.equal(tracked.status, 0, `${source}: ${tracked.stderr}`);
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: each drawn guide is a selected page frame with its trail, title, lead and pager`, () => {
    for (const page of pages) {
      const { document } = siteDocument(page.entry, viewport);
      const main = one(document, "site-docs-document");
      assert.equal(main.tagName, "main", page.entry);
      assert.equal(attribute(main, "id"), "main", page.entry);
      const frame = one(main, "site-docs-frame");
      // The frame's own label comes first; the selection with its size tag
      // comes last.
      const frameLabel = childElements(frame)[0]!;
      assert.match(attribute(frameLabel, "class") ?? "", /\bsite-frame-name\b/);
      assert.equal(attribute(frameLabel, "aria-hidden"), "true", page.entry);
      assert.equal(label(frameLabel), page.file, page.entry);
      const selection = childElements(frame).at(-1)!;
      assert.equal(byClass(selection, "site-sel-handle").length, 4, page.entry);
      assert.match(
        label(one(selection, "site-sel-size")),
        /^\d+ × \d+$/,
        page.entry,
      );
      assert.equal(
        label(one(frame, "site-trail")),
        "Documentation›Getting started",
      );
      assert.deepEqual(
        tags(document, "h1").map(label),
        [page.title],
        page.entry,
      );
      assert.equal(
        label(one(frame, "site-pullquote")),
        installedGuide(page.file).description,
        page.entry,
      );
      const pager = one(frame, "site-pager");
      assert.equal(attribute(pager, "aria-label"), "Pagination");
      assert.deepEqual(byClass(pager, "site-pager-label").map(label), [
        "Previous",
        "Next",
      ]);
      assert.deepEqual(byClass(pager, "site-docs-pager-title").map(label), [
        ...page.pager,
      ]);
      assert.equal(
        tags(pager, "a").length,
        0,
        `${page.entry}: no mockup owns the neighbours`,
      );
    }
  });

  test(`${viewport}: each drawn guide follows its sections and code word for word`, () => {
    for (const page of pages) {
      const { document } = siteDocument(page.entry, viewport);
      const main = one(document, "site-docs-document");
      const guide = installedGuide(page.file);
      const headings = tags(main, "h2");
      assert.deepEqual(headings.map(label), guide.headings, page.entry);
      assert.deepEqual(
        headings.map((node) => attribute(node, "id")),
        [...page.ids],
      );
      assert.deepEqual(codePanels(main), guide.fences, page.entry);
      for (const panel of byClass(main, "site-code")) {
        const shell = ["bash", "sh", "shell"].includes(
          label(one(panel, "site-code-language")),
        );
        const kind = shell ? "site-code--prompt" : "site-code--numbered";
        assert.ok(
          attribute(panel, "class")?.split(" ").includes(kind),
          `${page.entry}: ${kind}`,
        );
        assert.equal(label(one(panel, "site-code-copy")), "Copy");
      }
      // The desktop document draws On this page twice: in the Inspect panel
      // and in the disclosure that its narrower steps show.
      const outlines = byClass(document, "site-onpage");
      assert.equal(outlines.length, viewport === "desktop" ? 2 : 1);
      for (const [index, outline] of outlines.entries()) {
        const links = byClass(outline, "site-onpage-link");
        assert.deepEqual(
          links.map((link) => attribute(link, "href")),
          page.ids.map((id) => `#${id}`),
          `${page.entry}: outline ${index}`,
        );
        assert.deepEqual(
          links.map((link) => attribute(link, "aria-current")),
          page.ids.map((_, at) => (at === 0 ? "location" : undefined)),
          `${page.entry}: outline ${index}`,
        );
      }
    }
  });
}

test("desktop: the Inspect panel holds the page's properties, Edit on GitHub and On this page", () => {
  for (const page of pages) {
    const { document } = siteDocument(page.entry, "desktop");
    const inspect = one(one(document, "site-docs-rail"), "site-docs-inspect");
    assert.equal(inspect.tagName, "aside");
    assert.equal(attribute(inspect, "aria-label"), "Inspect");
    assert.equal(
      label(one(inspect, "site-panel-meta")),
      page.file.split("/")[1],
    );
    assert.deepEqual(facts(inspect), [
      ["Section", "Getting started"],
      ["Version", installedVersion()],
      ["Package", "@mokly/mokly"],
    ]);
    editLink(inspect, page.file);
    assert.equal(
      attribute(one(inspect, "site-onpage"), "aria-label"),
      "On this page",
    );
  }
});

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: On this page sits under the lead in a closed disclosure`, () => {
    for (const page of pages) {
      const { document } = siteDocument(page.entry, viewport);
      // The desktop document keeps the Inspect panel beside the disclosure,
      // and its steps show one of the two at each width.
      assert.equal(
        byClass(document, "site-docs-rail").length,
        viewport === "desktop" ? 1 : 0,
        page.entry,
      );
      const outline = one(document, "site-docs-outline");
      assert.equal(outline.tagName, "details");
      assert.equal(attribute(outline, "open"), undefined);
      const sheet = one(document, "site-page-sheet");
      const intro = childElements(sheet).findIndex((node) =>
        attribute(node, "class")?.includes("site-document-intro"),
      );
      assert.equal(childElements(sheet)[intro + 1], outline, page.entry);
      const summary = one(outline, "site-docs-outline-summary");
      assert.equal(summary.tagName, "summary");
      assert.match(label(summary), /^On this page/);
      assert.equal(
        label(one(summary, "site-docs-outline-count")),
        String(page.ids.length),
      );
      assert.deepEqual(facts(outline)[1], ["Version", installedVersion()]);
      editLink(outline, page.file);
    }
  });
