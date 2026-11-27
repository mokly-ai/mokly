import assert from "node:assert/strict";
import test from "node:test";

import { readReleases } from "../src/changelog/releases.js";
import { HOME_HERO } from "../src/home.js";
import {
  APP_PATHS,
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../src/navigation.js";

import {
  attribute,
  byClass,
  byTag,
  elements,
  markupLabel,
  one,
} from "./helpers/html.js";
import {
  builtFile,
  builtPage,
  byId,
  namedLinks,
} from "./helpers/site-output.js";

test("the home description and its social metadata repeat the hero lead", () => {
  const home = builtPage(SITE_PATHS.home);
  const lead = markupLabel(one(home, "site-hero-lead"));
  assert.equal(lead, HOME_HERO.lead, "hero lead");
  for (const [name, value] of [
    ["name", "description"],
    ["property", "og:description"],
    ["name", "twitter:description"],
  ] as const) {
    assert.deepEqual(
      byTag(home, "meta")
        .filter((meta) => attribute(meta, name) === value)
        .map((meta) => attribute(meta, "content")),
      [lead],
      value,
    );
  }
});

test("the hero and foundation publish the four home actions", () => {
  const home = builtPage(SITE_PATHS.home);
  assert.deepEqual(
    namedLinks(byId(home, "hero")),
    [
      ["Get started", GET_STARTED_PATH],
      ["Download for Mac", EXTERNAL_LINKS.desktopReleases],
    ],
    "hero actions",
  );
  assert.deepEqual(
    namedLinks(byId(home, "foundation")),
    [
      ["Docs", SITE_PATHS.docs],
      ["View on GitHub", EXTERNAL_LINKS.github],
    ],
    "foundation actions",
  );
  const [main] = byTag(home, "main");
  assert.ok(main, "home main");
  assert.equal(
    namedLinks(main).filter(([label]) => label === "Get started").length,
    1,
    "one Get started action in main",
  );
});

test("the home builds eight spread artboards and an ordered list of foundation steps", () => {
  const home = builtPage(SITE_PATHS.home);
  assert.equal(
    byClass(one(home, "site-home-spread"), "site-home-board").length,
    8,
    "spread artboards",
  );
  assert.equal(
    one(byId(home, "foundation"), "site-steps").tagName,
    "ol",
    "ordered foundation steps",
  );
});

test("the Review and Edit depictions publish no focusable elements", () => {
  const home = builtPage(SITE_PATHS.home);
  for (const id of ["review", "edit"]) {
    const controls = elements(
      byId(home, id),
      (node) =>
        ["button", "input", "select", "textarea", "iframe", "summary"].includes(
          node.tagName,
        ) ||
        (["a", "area"].includes(node.tagName) &&
          attribute(node, "href") !== undefined) ||
        attribute(node, "tabindex") !== undefined ||
        attribute(node, "contenteditable") !== undefined,
    );
    assert.deepEqual(
      controls.map((node) => node.tagName),
      [],
      id,
    );
  }
});

test("the pricing page publishes the plan and billing link targets", () => {
  const [main] = byTag(builtPage(SITE_PATHS.pricing), "main");
  assert.ok(main, "pricing main");
  assert.deepEqual(namedLinks(main), [
    ["Docs", SITE_PATHS.docs],
    ["Create an account", APP_PATHS.signUp],
    ["Start a 7-day trial", APP_PATHS.signUp],
    ["Read Plans and billing", "/docs/cloud/plans-and-billing/"],
  ]);
});

test("the changelog links the built Atom feed with the latest release", () => {
  const [newest] = readReleases();
  assert.ok(newest, "the changelog has at least one release");
  const page = builtPage(SITE_PATHS.changelog);
  const feed = byTag(page, "link").filter(
    (link) =>
      attribute(link, "rel") === "alternate" &&
      attribute(link, "type") === "application/atom+xml",
  );
  assert.deepEqual(
    feed.map((link) => attribute(link, "href")),
    ["/changelog.xml"],
    "Atom feed link",
  );
  assert.ok(
    builtFile("changelog.xml").includes(
      `<title>Mokly CLI ${newest.version}</title>`,
    ),
    "latest Atom entry",
  );
});

test("the changelog publishes the release frames, dates and links in order", () => {
  const releases = readReleases();
  const page = builtPage(SITE_PATHS.changelog);
  const [main] = byTag(page, "main");
  assert.ok(main, "changelog main");
  const articles = byTag(main, "article");
  assert.deepEqual(
    articles.map((article) => attribute(article, "id")),
    releases.map((release) => release.anchor),
    "release frame order",
  );
  const older = one(main, "site-changelog-earlier");
  assert.equal(attribute(older, "role"), "group", "earlier releases group");
  const groupName = attribute(older, "aria-labelledby");
  assert.ok(groupName, "earlier release group name");
  assert.equal(
    markupLabel(byId(older, groupName)),
    "Earlier releases",
    "earlier releases label",
  );
  assert.deepEqual(
    byTag(older, "article").map((article) => attribute(article, "id")),
    releases.slice(6).map((release) => release.anchor),
    "earlier release frames",
  );
  for (const release of releases) {
    const article = byId(main, release.anchor);
    assert.equal(
      attribute(article, "aria-labelledby"),
      release.titleId,
      "release frame name",
    );
    assert.equal(
      markupLabel(byId(article, release.titleId)),
      `Mokly CLI ${release.version}`,
      "release title",
    );
    assert.deepEqual(
      byTag(article, "time").map((time) => [
        attribute(time, "datetime"),
        markupLabel(time),
      ]),
      [[release.date, release.readableDate]],
      "release date",
    );
    assert.deepEqual(
      namedLinks(article).filter(([label]) => label === "Read release details"),
      release.link === null ? [] : [["Read release details", release.link]],
      "release details link",
    );
  }
});
