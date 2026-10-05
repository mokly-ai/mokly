import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  GUIDES,
  GUIDE_SECTIONS,
  guidesRoot,
  withoutFencedCode,
} from "./helpers/guides.js";

const SEARCH_FIELDS = new Map([
  ["the entry path", /(?:entry's|own) path/u],
  ["its authored title", /entry's title|own path, title/u],
  ["an entry tag", /entry's tags|own path, title and tags/u],
  [
    "a resolved title of any folder at or above its path",
    /title of a folder|titles of the folders/u,
  ],
]);

function missingSearchFields(summary: string): string[] {
  const prose = summary.replace(/\s+/gu, " ");
  return [...SEARCH_FIELDS]
    .filter(([, pattern]) => !pattern.test(prose))
    .map(([field]) => field);
}

test("catalogue guide summaries name every field of the folder search contract", () => {
  const contract = readFileSync(
    path.join(repositoryRoot, "docs/protocol/mokly-folders.md"),
    "utf8",
  );
  const fields = /one field: ([\s\S]*?)\. Empty free text/u
    .exec(contract)?.[1]
    ?.replace(/\s+/gu, " ")
    .split(/, (?:or )?/u);
  assert.deepEqual(
    fields,
    [...SEARCH_FIELDS.keys()],
    "update the guide field check when the search contract changes",
  );
  for (const id of ["catalogue/search-and-filters", "catalogue/browse"]) {
    const guide = GUIDES.find((entry) => entry.id === id);
    assert.ok(guide, id);
    assert.deepEqual(missingSearchFields(guide.body), [], id);
  }
});

test("the guide field check rejects a missing summary or any missing search field", () => {
  assert.equal(
    missingSearchFields("See the navigation reference for the search rule.")
      .length,
    4,
  );
  const phrases = [
    "entry's path",
    "entry's title",
    "entry's tags",
    "title of a folder",
  ];
  assert.deepEqual(missingSearchFields(phrases.join("; ")), []);
  for (let index = 0; index < phrases.length; index++)
    assert.deepEqual(
      missingSearchFields(
        phrases.filter((_, position) => index !== position).join("; "),
      ),
      [[...SEARCH_FIELDS.keys()][index]],
    );
});

const EXPECTED = [
  "start/install",
  "start/configure",
  "start/your-first-screen",
  "start/build",
  "start/serve",
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
];

const REFERENCE_SLUGS = new Set([
  "export-delivery",
  "export-ownership",
  "upload",
  "upload-exchange",
  "navigation",
  "link-controls",
  "pages",
]);

function allowedLink(destination: string): boolean {
  const target = destination.split("#", 1)[0] ?? "";
  if (target === "/docs/" || target === "/changelog/") return true;
  const guide =
    /^\/docs\/(start|authoring|catalogue|ci|cli)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(
      target,
    );
  if (guide) return true;
  const reference = /^\/docs\/reference\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(
    target,
  );
  if (reference) return REFERENCE_SLUGS.has(reference[1] ?? "");
  try {
    const url = new URL(destination);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

test("the guide tree contains the exact 31-page reading order", () => {
  assert.deepEqual(
    GUIDES.map((guide) => guide.id),
    EXPECTED,
  );
  assert.deepEqual(
    readdirSync(guidesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    [...GUIDE_SECTIONS].sort(),
  );
  assert.equal(
    readdirSync(guidesRoot, { recursive: true, withFileTypes: true }).filter(
      (entry) => entry.isFile(),
    ).length,
    31,
  );
});

test("frontmatter is restricted, bounded, and unique within each section", () => {
  const orders = new Set<string>();
  for (const guide of GUIDES) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, guide.id);
    assert.equal(guide.frontmatter.section, guide.id.split("/")[0], guide.id);
    assert.equal(guide.frontmatter.title.trim(), guide.frontmatter.title);
    assert.ok(guide.frontmatter.title.length > 0, guide.id);
    assert.equal(
      guide.frontmatter.description.trim(),
      guide.frontmatter.description,
      guide.id,
    );
    assert.ok(
      [...guide.frontmatter.description].length >= 1 &&
        [...guide.frontmatter.description].length <= 180,
      guide.id,
    );
    assert.ok(Number.isSafeInteger(guide.frontmatter.order), guide.id);
    assert.ok(guide.frontmatter.order > 0, guide.id);
    assert.deepEqual(
      guide.frontmatterSource.split("\n").map((line) => line.split(":")[0]),
      ["title", "description", "section", "order"],
      guide.id,
    );
    const key = `${guide.frontmatter.section}:${guide.frontmatter.order}`;
    assert.ok(!orders.has(key), `${key} is duplicated`);
    orders.add(key);
  }
});

test("bodies use headings, comments, and fenced code within the contract", () => {
  for (const guide of GUIDES) {
    const headings = new Set<string>();
    let fenced = false;
    for (const line of guide.body.split("\n")) {
      if (line.startsWith("```")) {
        if (fenced) assert.equal(line, "```", guide.id);
        else assert.match(line, /^```[a-z][a-z0-9+-]*$/u, guide.id);
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const heading = /^(#{1,6}) (.+)$/u.exec(line);
      if (!heading) continue;
      assert.ok((heading[1]?.length ?? 0) >= 2, guide.id);
      assert.notEqual(heading[2], guide.frontmatter.title, guide.id);
      assert.ok(!headings.has(heading[2] ?? ""), `${guide.id}: ${heading[2]}`);
      headings.add(heading[2] ?? "");
    }
    assert.equal(fenced, false, `${guide.id} has an open fence`);
    const prose = withoutFencedCode(guide.body)
      .replace(/<!--[\s\S]*?-->/gu, "")
      .replace(/`[^`]*`/gu, "");
    assert.doesNotMatch(prose, /<\/?[A-Za-z][^>]*>/u, guide.id);
    assert.doesNotMatch(prose, /^\s*(?:import|export)\s/mu, guide.id);
  }
});

test("guide links use only bounded destinations", () => {
  for (const guide of GUIDES) {
    const prose = withoutFencedCode(guide.body).replace(
      /<!--[\s\S]*?-->/gu,
      "",
    );
    for (const match of prose.matchAll(/!?\[[^\]]*\]\(([^\s)]+)[^)]*\)/gu))
      assert.ok(allowedLink(match[1] ?? ""), `${guide.id}: ${match[1]}`);
  }
  for (const destination of [
    "/docs/authoring/screens/",
    "/docs/reference/upload-exchange/#export-files-and-limits",
    "/docs/",
    "/changelog/#v0100",
    "https://example.com/docs",
    "http://localhost:4173/docs",
  ])
    assert.equal(allowedLink(destination), true, destination);
  for (const destination of [
    "../authoring/screens.md",
    "./screens.md",
    "/docs/cloud/overview/",
    "/docs/reference/private-contract/",
    "docs/protocol/mokly-upload.md",
    "file:///tmp/guide.md",
  ])
    assert.equal(allowedLink(destination), false, destination);
});
