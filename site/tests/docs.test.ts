import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readFrontmatter } from "../src/docs/frontmatter.js";
import { assertUniqueHeadings, onThisPage } from "../src/docs/headings.js";
import {
  DOCS_OVERVIEW,
  DOCS_PAGES,
  DOCS_SECTIONS,
  assertCollection,
  neighbours,
  pageAt,
} from "../src/docs/pages.js";
import {
  SECTION_IDS,
  SECTION_SUMMARIES,
  SECTION_TITLES,
  sectionOrder,
} from "../src/docs/sections.js";
import {
  INSTALL_COMMAND,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  pinnedInstallCommand,
} from "../src/docs/version.js";
import { repositoryPath } from "../src/workspace.js";

const page = (id: string) => DOCS_PAGES.find((entry) => entry.id === id);

test("frontmatter is read and validated against the content model", () => {
  const { data, body } = readFrontmatter(
    '---\ntitle: "Install"\ndescription: "Add Mokly."\nsection: "start"\norder: 1\n---\n\nBody.\n',
    "start/install.mdx",
  );
  assert.deepEqual(data, {
    description: "Add Mokly.",
    order: 1,
    section: "start",
    title: "Install",
  });
  assert.equal(body.trim(), "Body.");
});

test("frontmatter rejects an unknown section and a missing field", () => {
  assert.throws(
    () =>
      readFrontmatter(
        '---\ntitle: "T"\ndescription: "D"\nsection: "guides"\norder: 1\n---\n',
        "guides/t.mdx",
      ),
    /section/,
  );
  assert.throws(
    () =>
      readFrontmatter(
        '---\ntitle: "T"\nsection: "cli"\norder: 1\n---\n',
        "cli/t.mdx",
      ),
    /description/,
  );
  assert.throws(
    () => readFrontmatter("Body only\n", "cli/t.mdx"),
    /frontmatter/,
  );
});

test("an ahead page keeps its status and it is never rendered", () => {
  const { data } = readFrontmatter(
    '---\ntitle: "Overview"\ndescription: "D"\nsection: "cloud"\norder: 1\nstatus: "ahead"\n---\n',
    "cloud/overview.mdx",
  );
  assert.equal(data.status, "ahead");
  assert.deepEqual(
    DOCS_PAGES.filter((entry) => entry.status === "ahead").map(
      (entry) => entry.id,
    ),
    [],
    "no page is written ahead of release yet",
  );
});

test("every section has a title, a summary and its place in the order", () => {
  for (const [index, id] of SECTION_IDS.entries()) {
    assert.equal(sectionOrder(id), index);
    assert.ok(SECTION_TITLES[id].length > 0, id);
    assert.ok(SECTION_SUMMARIES[id].length > 0, id);
  }
  assert.deepEqual(
    DOCS_SECTIONS.map((section) => section.id),
    ["start", "authoring", "catalogue", "cli", "ci", "reference"],
  );
});

test("pages are ordered inside their section and own their route", () => {
  for (const section of DOCS_SECTIONS) {
    const orders = section.pages.map((entry) => entry.order);
    assert.deepEqual(
      orders,
      [...orders].sort((a, b) => a - b),
      section.id,
    );
    assert.equal(new Set(orders).size, orders.length, section.id);
    for (const entry of section.pages) {
      assert.equal(entry.route, `/docs/${entry.id}/`);
      assert.equal(pageAt(entry.route)?.id, entry.id);
    }
  }
  assert.equal(
    new Set(DOCS_PAGES.map((entry) => entry.id)).size,
    DOCS_PAGES.length,
  );
});

test("previous and next walk the whole documentation once, overview first", () => {
  const routes = [
    DOCS_OVERVIEW.route,
    ...DOCS_PAGES.map((entry) => entry.route),
  ];
  assert.equal(neighbours(DOCS_OVERVIEW.route).previous, undefined);
  assert.equal(neighbours(DOCS_OVERVIEW.route).next?.route, routes[1]);
  for (const [index, route] of routes.entries()) {
    const { next, previous } = neighbours(route);
    assert.equal(previous?.route, routes[index - 1], route);
    assert.equal(next?.route, routes[index + 1], route);
  }
  assert.equal(neighbours(routes.at(-1) ?? "").next, undefined);
  assert.deepEqual(neighbours("/docs/nowhere/"), {});
});

test("the section tree crosses from one section into the next", () => {
  const install = page("start/install");
  assert.equal(neighbours(install?.route ?? "").previous?.route, "/docs/");
  const last = DOCS_SECTIONS[0]?.pages.at(-1);
  assert.equal(
    neighbours(last?.route ?? "").next?.route,
    DOCS_SECTIONS[1]?.pages[0]?.route,
  );
});

test("the collection and the section tree describe the same pages", () => {
  const authored = DOCS_PAGES.filter((entry) => entry.kind === "page").map(
    (entry) => entry.id,
  );
  assertCollection(authored);
  assert.throws(() => assertCollection([...authored, "start/extra"]), /extra/);
  assert.throws(() => assertCollection(authored.slice(1)), /navigation lists/);
});

test("the on-this-page list takes the second and third level headings", () => {
  const headings = [
    { depth: 1, slug: "title", text: "Title" },
    { depth: 2, slug: "one", text: "One" },
    { depth: 3, slug: "two", text: "Two" },
    { depth: 4, slug: "three", text: "Three" },
  ];
  assert.deepEqual(
    onThisPage(headings).map((heading) => heading.slug),
    ["one", "two"],
  );
});

test("a page that repeats a heading fails the build", () => {
  assert.throws(
    () =>
      assertUniqueHeadings(
        [
          { depth: 2, slug: "usage", text: "Usage" },
          { depth: 2, slug: "usage-1", text: "Usage" },
        ],
        "cli/serve",
      ),
    /repeats the heading "Usage"/,
  );
  assertUniqueHeadings(
    [{ depth: 2, slug: "usage", text: "Usage" }],
    "cli/serve",
  );
});

test("every authored page carries a title and a lead of its own", () => {
  const descriptions = new Set<string>();
  for (const entry of DOCS_PAGES) {
    assert.ok(entry.title.length > 0, entry.id);
    assert.ok(
      entry.description.length > 0 && entry.description.length <= 180,
      entry.id,
    );
    assert.ok(
      !descriptions.has(entry.description),
      `${entry.id} repeats its lead`,
    );
    descriptions.add(entry.description);
  }
});

test("the version comes from the workspace package", () => {
  const manifest = JSON.parse(
    readFileSync(repositoryPath("package.json"), "utf8"),
  ) as { name: string; version: string };
  assert.equal(PACKAGE_NAME, manifest.name);
  assert.equal(PACKAGE_VERSION, manifest.version);
  assert.equal(
    INSTALL_COMMAND,
    "npm install --save-dev @mokly/mokly react react-dom",
  );
  assert.equal(
    pinnedInstallCommand(),
    `npm install --save-dev @mokly/mokly@${manifest.version}`,
  );
});

test("no page writes an install command of its own", () => {
  for (const entry of DOCS_PAGES.filter((page) => page.kind === "page")) {
    const source = readFileSync(entry.source, "utf8");
    assert.doesNotMatch(
      source,
      /npm install[^\n]*@mokly\/mokly/,
      `${entry.id} should use the Install component`,
    );
  }
});
