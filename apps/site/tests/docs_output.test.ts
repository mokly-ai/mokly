import assert from "node:assert/strict";
import test from "node:test";

import { DOCS_OVERVIEW, neighbours, pageAt } from "../src/docs/pages.js";
import { SECTION_TITLES } from "../src/docs/sections.js";
import { MOKLY_PACKAGE_VERSION } from "../src/mokly-package.js";
import { SITE_PATHS } from "../src/navigation.js";

import { attribute, byClass, byTag, markupLabel, one } from "./helpers/html.js";
import {
  anchors,
  builtPage,
  labelled,
  namedLinks,
} from "./helpers/site-output.js";

const SERVE = "/docs/cli/serve/";

test("the serve guide publishes its lead and section trail", () => {
  const page = builtPage(SERVE);
  const guide = pageAt(SERVE);
  assert.ok(guide, "serve guide");
  assert.equal(
    markupLabel(one(page, "site-pullquote")),
    guide.description,
    "guide lead",
  );
  const [trail] = labelled(page, "nav", "Location");
  assert.ok(trail, "Location trail");
  assert.ok(
    byClass(trail, "site-trail-step")
      .map(markupLabel)
      .includes(SECTION_TITLES[guide.section]),
    "section in Location trail",
  );
});

test("both docs trees name the current page and link to the published CLI version and changelog", () => {
  const page = builtPage(SERVE);
  const trees = labelled(page, "nav", "Documentation");
  assert.equal(trees.length, 2, "Layers panel and tree sheet");
  for (const tree of trees) {
    const current = anchors(tree).filter(
      (link) => attribute(link, "aria-current") === "page",
    );
    assert.deepEqual(
      current.map((link) => [markupLabel(link), attribute(link, "href")]),
      [["serve", SERVE]],
      "current docs page",
    );
    const version = one(tree, "site-version-link");
    assert.equal(
      markupLabel(one(version, "site-version-label")),
      "Mokly CLI",
      "CLI label",
    );
    assert.equal(
      markupLabel(one(version, "site-chip")),
      MOKLY_PACKAGE_VERSION,
      "CLI version",
    );
    assert.equal(
      attribute(version, "href"),
      SITE_PATHS.changelog,
      "CLI version link",
    );
    assert.deepEqual(
      namedLinks(tree).filter(([label]) => label === "Changelog"),
      [["Changelog", SITE_PATHS.changelog]],
      "tree foot link",
    );
  }
});

test("the overview and serve pagers link to their neighbours in tree order", () => {
  for (const route of [DOCS_OVERVIEW.route, SERVE]) {
    const [pager] = labelled(builtPage(route), "nav", "Pagination");
    assert.ok(pager, `${route} has a pager`);
    const { previous, next } = neighbours(route);
    const expected = [
      ...(previous ? [["Previous", previous.route]] : []),
      ...(next ? [["Next", next.route]] : []),
    ];
    assert.deepEqual(
      anchors(pager).map((link) => [
        markupLabel(one(link, "site-pager-label")),
        attribute(link, "href"),
      ]),
      expected,
      route,
    );
  }
});

test("the upload reference publishes its Markdown with rewritten links", () => {
  const page = builtPage("/docs/reference/upload/");
  const links = namedLinks(one(page, "site-document-body"));
  assert.equal(
    links.find(([label]) => label === "exchange contract")?.[1],
    "/docs/reference/upload-exchange/#upload-exchange",
    "reference exchange link",
  );
  assert.ok(
    links.some(([label]) => label === "ownership marker"),
    "reference ownership link",
  );
});

test("the cloud overview publishes its Markdown body", () => {
  const page = builtPage("/docs/cloud/overview/");
  assert.ok(
    byTag(one(page, "site-document-body"), "h2").some(
      (heading) => markupLabel(heading) === "A catalogue for every branch",
    ),
    "overview body heading",
  );
});

test("plans and billing publishes the Editor and Collaborator seat rows", () => {
  const page = builtPage("/docs/cloud/plans-and-billing/");
  const [editor, collaborator] = byTag(
    one(page, "site-document-body"),
    "tbody",
  ).flatMap((body) => byTag(body, "tr"));
  assert.ok(editor && collaborator, "seat rows");
  assert.match(markupLabel(editor), /Editor/, "first seat row");
  assert.match(markupLabel(collaborator), /Collaborator/, "second seat row");
});
