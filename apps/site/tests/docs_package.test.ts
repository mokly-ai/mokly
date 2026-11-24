import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import type { HastPluginEntry } from "satteri";

import { readFrontmatter } from "../src/docs/frontmatter.js";
import { DOCS_PAGES, GUIDE_CONTENT } from "../src/docs/pages.js";
import {
  REFERENCE_DOCUMENTS,
  referenceRoute,
} from "../src/docs/reference-allowlist.js";
import { samplePath } from "../src/docs/sample-path.js";
import { MOKLY_PACKAGE_VERSION } from "../src/mokly-package.js";

const EXPECTED = [
  "start/install",
  "start/configure",
  "start/your-first-screen",
  "start/build",
  "start/serve",
  "start/upgrade",
  "authoring/config",
  "authoring/screens",
  "authoring/components",
  "authoring/viewports-and-color-schemes",
  "authoring/collections-and-tags",
  "authoring/use-case-flows",
  "authoring/pages",
  "authoring/links",
  "authoring/review-ignore",
  "authoring/styles",
  "authoring/props-and-variants",
  "authoring/storybook",
  "authoring/vite",
  "catalogue/browse",
  "catalogue/search-and-filters",
  "catalogue/changes",
  "catalogue/details",
  "catalogue/export-and-host",
  "ci/github-action",
  "ci/publish-from-ci",
  "ci/project-tokens",
  "ci/the-upload",
  "ci/the-check-on-a-pull-request",
  "cli/serve",
  "cli/build",
  "cli/check",
  "cli/export",
  "cli/publish",
  "cli/options-and-exit-status",
] as const;

const guides = DOCS_PAGES.filter((page) => page.kind === "guide");

function withoutFencedCode(source: string): string {
  const kept: string[] = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) kept.push(line);
  }
  return kept.join("\n");
}

function allowedLink(destination: string): boolean {
  if (/^https?:\/\//u.test(destination)) {
    try {
      const url = new URL(destination);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  const route = destination.split(/[?#]/u)[0];
  if (route === "/docs/" || route === "/changelog/") return true;
  if (EXPECTED.some((id) => route === `/docs/${id}/`)) return true;
  return REFERENCE_DOCUMENTS.some(
    (document) => route === referenceRoute(document.slug),
  );
}

async function markdownLinks(source: string): Promise<readonly string[]> {
  const links: string[] = [];
  const collect: HastPluginEntry = {
    name: "collect-guide-links",
    element: {
      filter: ["a"],
      visit(node) {
        const href = node.properties?.["href"];
        if (typeof href === "string") links.push(href);
      },
    },
  };
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [collect],
    syntaxHighlight: false,
  });
  await processor.render(source, {});
  return links;
}

test("the installed package supplies the exact 35-guide reading order", () => {
  assert.deepEqual(
    guides.map((guide) => guide.id),
    EXPECTED,
  );
  const files = readdirSync(GUIDE_CONTENT, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(GUIDE_CONTENT, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
  assert.deepEqual(files, EXPECTED.map((id) => `${id}.md`).sort());
});

test("package guide frontmatter and CommonMark stay inside the site boundary", async () => {
  for (const guide of guides) {
    const source = readFileSync(guide.source, "utf8");
    const boundary = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source);
    assert.ok(boundary, guide.id);
    const fields = (boundary[1] ?? "").split("\n");
    assert.deepEqual(
      fields.map((line) => line.split(":", 1)[0]),
      ["title", "description", "section", "order"],
      guide.id,
    );
    for (const [index, name] of ["title", "description", "section"].entries())
      assert.match(
        fields[index] ?? "",
        new RegExp(`^${name}: "(?:[^"\\\\]|\\\\.)*"$`, "u"),
        guide.id,
      );
    assert.match(fields[3] ?? "", /^order: [1-9]\d*$/u, guide.id);

    const { body, data } = readFrontmatter(source, guide.id);
    assert.equal(data.section, guide.section, guide.id);
    assert.equal(data.status, undefined, guide.id);
    const headings = new Set<string>();
    let fenced = false;
    for (const line of body.split("\n")) {
      if (line.startsWith("```")) {
        if (fenced) assert.equal(line, "```", guide.id);
        else
          assert.ok(
            /^```[a-z][a-z0-9+-]*$/u.test(line) ||
              (line.startsWith("```html ") &&
                samplePath(line.slice(8)) !== undefined),
            `${guide.id}: ${line}`,
          );
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const heading = /^(#{1,6}) (.+)$/u.exec(line);
      if (!heading) continue;
      assert.ok((heading[1]?.length ?? 0) >= 2, guide.id);
      assert.notEqual(heading[2], data.title, guide.id);
      assert.ok(!headings.has(heading[2] ?? ""), `${guide.id}: ${heading[2]}`);
      headings.add(heading[2] ?? "");
    }
    assert.equal(fenced, false, `${guide.id}: unclosed code fence`);
    const prose = withoutFencedCode(body)
      .replace(/<!--[\s\S]*?-->/gu, "")
      .replace(/`[^`]*`/gu, "");
    assert.doesNotMatch(prose, /<\/?[A-Za-z][^>]*>/u, guide.id);
    assert.doesNotMatch(prose, /^\s*(?:import|export)\s/mu, guide.id);
    assert.doesNotMatch(prose, /\{\/\*/u, guide.id);
    for (const destination of await markdownLinks(body))
      assert.ok(
        allowedLink(destination),
        `${guide.id}: ${destination} is outside the guide link contract`,
      );
  }
});

test("every guide version literal equals the installed package", () => {
  const found: Array<{ id: string; version: string }> = [];
  for (const guide of guides) {
    const source = readFileSync(guide.source, "utf8");
    for (const match of source.matchAll(/(?<![\d.])\d+\.\d+\.\d+(?!\.\d)/gu))
      found.push({ id: guide.id, version: match[0] });
  }
  assert.deepEqual(found, [
    { id: "start/install", version: MOKLY_PACKAGE_VERSION },
    { id: "start/install", version: MOKLY_PACKAGE_VERSION },
    { id: "ci/github-action", version: MOKLY_PACKAGE_VERSION },
  ]);
});
