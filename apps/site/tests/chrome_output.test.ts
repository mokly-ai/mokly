import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_LINKS,
  GET_STARTED_PATH,
  SITE_PATHS,
} from "../src/navigation.js";

import { attribute, byTag, one } from "./helpers/html.js";
import {
  anchors,
  builtPage,
  byId,
  linkTargets,
  namedLinks,
} from "./helpers/site-output.js";

const MAIN_LINKS = [
  ["Docs", SITE_PATHS.docs],
  ["Changelog", SITE_PATHS.changelog],
  ["Pricing", SITE_PATHS.pricing],
  ["GitHub", EXTERNAL_LINKS.github],
] as const;

test("the toolbar and menu publish their destinations in order", () => {
  const home = builtPage(SITE_PATHS.home);
  const header = one(home, "site-header");
  const main = one(header, "site-nav");
  assert.deepEqual(namedLinks(main), MAIN_LINKS, "toolbar navigation");
  assert.equal(
    attribute(one(header, "site-brand"), "href"),
    SITE_PATHS.home,
    "toolbar brand",
  );
  assert.equal(
    attribute(one(header, "site-header-cta"), "href"),
    GET_STARTED_PATH,
    "toolbar Get started",
  );
  const menu = byId(header, "site-menu");
  assert.deepEqual(
    namedLinks(menu),
    [...MAIN_LINKS, ["Get started", GET_STARTED_PATH]],
    "menu navigation",
  );
  assert.equal(
    byTag(header, "button").filter(
      (button) => attribute(button, "aria-controls") === "site-menu",
    ).length,
    1,
    "one menu control",
  );
});

test("the footer publishes its destination inventory", () => {
  const footer = one(builtPage(SITE_PATHS.home), "site-footer");
  assert.deepEqual(linkTargets(footer), [
    SITE_PATHS.home,
    ...Object.values(SITE_PATHS),
  ]);
});

test("the toolbar, menu and footer mark their current route", () => {
  for (const route of Object.values(SITE_PATHS)) {
    const page = builtPage(route);
    for (const region of ["site-nav", "site-menu-nav", "site-footer-nav"]) {
      const links = anchors(one(page, region));
      const current = links.filter(
        (link) => attribute(link, "aria-current") === "page",
      );
      const expected = links.some((link) => attribute(link, "href") === route)
        ? [route]
        : [];
      assert.deepEqual(
        current.map((link) => attribute(link, "href")),
        expected,
        `${route} ${region}`,
      );
    }
  }
});
