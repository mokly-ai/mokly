import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { readFrontmatter } from "../../../../apps/site/src/docs/frontmatter";
import { REFERENCE_DOCUMENTS } from "../../../../apps/site/src/docs/reference-allowlist";
import {
  SECTION_IDS,
  SECTION_TITLES,
} from "../../../../apps/site/src/docs/sections";
import { DOCS_SECTIONS } from "../screens/design/site/parts/docs_data";
import { repositoryRoot } from "./design-site-test-helpers";

function pageLabels(directory: string) {
  return readdirSync(resolve(repositoryRoot, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const { data } = readFrontmatter(
        readFileSync(resolve(entry.parentPath, entry.name), "utf8"),
        entry.name,
      );
      return data;
    });
}

test("depicted documentation sections and page labels match the site", () => {
  const pages = [
    ...pageLabels("node_modules/@mokly/mokly/docs/guides"),
    ...pageLabels("apps/site/src/content/docs"),
    ...REFERENCE_DOCUMENTS.map(({ title, order }) => ({
      section: "reference",
      title,
      order,
    })),
  ];
  assert.deepEqual(
    DOCS_SECTIONS,
    SECTION_IDS.map((id) => ({
      title: SECTION_TITLES[id],
      pages: pages
        .filter(({ section }) => section === id)
        .sort((left, right) => left.order - right.order)
        .map(({ title }) => title),
    })),
  );
});
