import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateSiteSegments,
  renderSiteSegments,
  siteFirstSegments,
} from "../scripts/generate-site-segments.js";
import { SITE_OUTPUT_FIRST_SEGMENTS, SITE_PATHS } from "../src/navigation.js";

const expected = [
  "_astro",
  "brand",
  "changelog",
  "changelog.xml",
  "complaints",
  "docs",
  "favicon.svg",
  "og",
  "pagefind",
  "pricing",
  "privacy",
  "robots.txt",
  "security",
  "sitemap.xml",
  "terms",
];

async function fixture(t: test.TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-segments-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    dist: path.join(root, "dist"),
    output: path.join(root, "site-segments.ts"),
  };
}

test("site routes and stable outputs derive one sorted segment set", () => {
  assert.deepEqual(
    siteFirstSegments(Object.values(SITE_PATHS), SITE_OUTPUT_FIRST_SEGMENTS),
    expected,
  );
  assert.match(renderSiteSegments(expected), /SITE_FIRST_SEGMENTS/);
});

test("generation works on a clean checkout without built output", async (t) => {
  const paths = await fixture(t);
  await generateSiteSegments({ ...paths, check: false });
  assert.equal(
    await readFile(paths.output, "utf8"),
    renderSiteSegments(expected),
  );
  await generateSiteSegments({ ...paths, check: true });
});

test("built output must match the declared routing set", async (t) => {
  const paths = await fixture(t);
  await mkdir(paths.dist);
  for (const name of ["404.html", "_headers", "index.html", ...expected]) {
    const target = path.join(paths.dist, name);
    if (name.includes(".")) await writeFile(target, "fixture");
    else await mkdir(target);
  }
  await generateSiteSegments({ ...paths, check: false });
  await mkdir(path.join(paths.dist, "dashboard"));
  await assert.rejects(
    generateSiteSegments({ ...paths, check: true }),
    /unexpected: dashboard/,
  );
});

test("check mode rejects a stale committed module", async (t) => {
  const paths = await fixture(t);
  await writeFile(paths.output, "export const SITE_FIRST_SEGMENTS = [];\n");
  await assert.rejects(
    generateSiteSegments({ ...paths, check: true }),
    /generated site segment module is stale/,
  );
});

test("check mode preserves the missing module filesystem error", async (t) => {
  const paths = await fixture(t);
  await assert.rejects(
    generateSiteSegments({ ...paths, check: true }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /generated site segment module is missing/);
      assert.ok(error.cause instanceof Error);
      assert.equal((error.cause as NodeJS.ErrnoException).code, "ENOENT");
      return true;
    },
  );
});
