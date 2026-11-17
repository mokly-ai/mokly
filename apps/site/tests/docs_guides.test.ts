import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";

import { guideDocument, validateGuideReference } from "../src/docs/guides.js";
import { DOCS_PAGES, GUIDE_CONTENT } from "../src/docs/pages.js";
import { sitePath } from "../src/workspace.js";

import path from "node:path";
import { pathToFileURL } from "node:url";

test("guides keep allowlisted Reference links with their query and fragment", async () => {
  const href = "/docs/reference/navigation/?view=all#catalogue-urls";
  assert.doesNotThrow(() =>
    validateGuideReference(href, "catalogue/browse.md"),
  );
  for (const target of [
    "/docs/reference/private/",
    "/docs/reference/navigation/extra/",
  ])
    assert.throws(
      () => validateGuideReference(target, "fixture.md"),
      /not allowlisted/,
    );
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [guideDocument],
    syntaxHighlight: false,
  });
  const rendered = await processor.render(`[Navigation](${href})`, {
    fileURL: pathToFileURL(path.join(GUIDE_CONTENT, "catalogue/browse.md")),
  });
  assert.ok(rendered.code.includes(`href="${href}"`));
  await assert.rejects(
    processor.render("[Private](/docs/reference/private/)", {
      fileURL: pathToFileURL(path.join(GUIDE_CONTENT, "catalogue/browse.md")),
    }),
    /not allowlisted/,
  );
  for (const slug of ["browse", "search-and-filters"]) {
    const html = readFileSync(
      sitePath("dist/docs/catalogue", slug, "index.html"),
      "utf8",
    );
    assert.ok(html.includes('href="/docs/reference/navigation/"'));
  }
});

test("the released guide labels and all fence languages reach the site", () => {
  const pages = DOCS_PAGES.filter((page) => page.kind === "guide");
  assert.equal(
    pages.find((page) => page.id === "authoring/pages")?.title,
    "Pages and documents",
  );
  assert.equal(pages.find((page) => page.id === "authoring/styles")?.order, 10);
  const languages = new Set(
    pages.flatMap((page) =>
      [...readFileSync(page.source, "utf8").matchAll(/^```([a-z]+)$/gmu)].map(
        (match) => match[1],
      ),
    ),
  );
  for (const language of [
    "css",
    "js",
    "json",
    "markdown",
    "sh",
    "http",
    "shell",
    "text",
    "ts",
    "tsx",
    "yaml",
  ])
    assert.ok(languages.has(language), language);
  const styles = readFileSync(
    sitePath("dist/docs/authoring/styles/index.html"),
    "utf8",
  );
  for (const language of ["css", "js", "sh", "tsx"])
    assert.ok(styles.includes(`data-language="${language}"`), language);
});
