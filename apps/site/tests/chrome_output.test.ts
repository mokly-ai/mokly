import assert from "node:assert/strict";
import test from "node:test";

import { attribute, byTag, markupLabel, one } from "./helpers/html.js";
import { NOT_FOUND_PAGE, ROUTES } from "./helpers/published-routes.js";
import { anchors, builtPage, byId } from "./helpers/site-output.js";

const MAIN_LINKS = [
  ["Docs", "/docs/"],
  ["Changelog", "/changelog/"],
  ["Pricing", "/pricing/"],
  ["GitHub", "https://github.com/mokly-ai/mokly"],
] as const;

const FOOTER_LINKS = [
  ["Home", "/"],
  ["Docs", "/docs/"],
  ["Changelog", "/changelog/"],
  ["Pricing", "/pricing/"],
  ["Terms", "/terms/"],
  ["Privacy", "/privacy/"],
  ["Complaints", "/complaints/"],
  ["Security", "/security/"],
] as const;

const BRAND = [["Mokly home", "/"]] as const;
const GET_STARTED = [["Get started", "/sign-up"]] as const;

for (const { route } of ROUTES) {
  test(`${route} publishes the shared chrome links and current markers`, () => {
    const page = builtPage(route);
    const header = one(page, "site-header");
    const footer = one(page, "site-footer");
    const menu = byId(header, "site-menu");
    const current =
      route === NOT_FOUND_PAGE.route
        ? undefined
        : route.startsWith("/docs/")
          ? "/docs/"
          : route;

    const regions = [
      ["site-nav", one(header, "site-nav"), MAIN_LINKS],
      ["site-menu-nav", one(menu, "site-menu-nav"), MAIN_LINKS],
      ["site-footer-nav", one(footer, "site-footer-nav"), FOOTER_LINKS],
      ["header brand", one(header, "site-brand"), BRAND],
      ["header Get started", one(header, "site-header-cta"), GET_STARTED],
      ["menu", menu, [...MAIN_LINKS, ...GET_STARTED]],
      ["footer", footer, [...BRAND, ...FOOTER_LINKS]],
    ] as const;

    for (const [region, node, links] of regions) {
      assert.deepEqual(
        anchors(node).map((link) => [
          markupLabel(link),
          attribute(link, "href"),
          attribute(link, "aria-current"),
        ]),
        links.map(([label, href]) => [
          label,
          href,
          href === current ? "page" : undefined,
        ]),
        `${route} ${region} links`,
      );
    }

    assert.equal(
      byTag(header, "button").filter(
        (button) => attribute(button, "aria-controls") === "site-menu",
      ).length,
      1,
      "one menu control",
    );
  });
}
