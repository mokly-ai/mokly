import assert from "node:assert/strict";
import test from "node:test";

import { pagerEntries } from "../src/components/docs/pager-entries.js";
import { DOCS_OVERVIEW, DOCS_PAGES } from "../src/docs/pages.js";

function description(id: string): string {
  const found = DOCS_PAGES.find((entry) => entry.id === id);
  assert.ok(found, `${id} is a documentation page`);
  return found.description;
}

test("previous and next name each neighbour's section, title and description", () => {
  assert.deepEqual(pagerEntries("/docs/start/install/"), {
    next: {
      description: description("start/configure"),
      route: "/docs/start/configure/",
      section: "Getting started",
      title: "Configure",
    },
    previous: {
      description: DOCS_OVERVIEW.description,
      route: "/docs/",
      section: "Documentation",
      title: "Getting started",
    },
  });
  assert.deepEqual(pagerEntries("/docs/").next, {
    description: description("start/install"),
    route: "/docs/start/install/",
    section: "Getting started",
    title: "Install",
  });
  assert.equal(pagerEntries("/docs/").previous, undefined);
});
