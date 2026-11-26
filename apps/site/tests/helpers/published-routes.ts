import { DOCS_PAGES } from "../../src/docs/pages.js";
import { NOT_FOUND_ROUTE, PAGE_METADATA } from "../../src/metadata.js";
import { PAGES } from "../browser/routes.js";

export const NOT_FOUND_PAGE = {
  heading: "Page not found",
  route: NOT_FOUND_ROUTE,
  title: PAGE_METADATA[NOT_FOUND_ROUTE].title,
};

export const ROUTES = [
  ...PAGES,
  ...DOCS_PAGES.map(({ route, title: heading }) => ({
    heading,
    route,
    title: `${heading} · Mokly`,
  })),
  NOT_FOUND_PAGE,
];
