import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { checkSearch } from "../scripts/links/search.js";

test("Pagefind handles no docs and indexes only docs when present", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-search-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, "index.html"),
    '<html lang="en"><body><h1>Marketing</h1></body></html>',
  );
  const run = () =>
    promisify(execFile)(process.execPath, ["scripts/index-search.mjs", root], {
      cwd: path.resolve(import.meta.dirname, ".."),
      timeout: 30_000,
    });
  assert.match((await run()).stdout, /indexed 0 documentation pages/);
  await assert.rejects(access(path.join(root, "pagefind")), { code: "ENOENT" });
  await mkdir(path.join(root, "docs", "start"), { recursive: true });
  await writeFile(
    path.join(root, "docs", "index.html"),
    '<html lang="en"><body><h1>Documentation</h1></body></html>',
  );
  await writeFile(
    path.join(root, "docs", "start", "index.html"),
    '<html lang="en"><body><h1>Install</h1></body></html>',
  );
  assert.match((await run()).stdout, /indexed 2 documentation pages/);
  await access(path.join(root, "pagefind", "pagefind.js"));
  const entry = JSON.parse(
    await readFile(path.join(root, "pagefind", "pagefind-entry.json"), "utf8"),
  ) as { languages: Record<string, { page_count: number }> };
  assert.equal(entry.languages["en"]?.page_count, 2);
});

test("the link check requires an index covering every documentation page", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-index-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(
    await checkSearch(root),
    0,
    "a site with no docs needs no index",
  );
  await mkdir(path.join(root, "docs", "start"), { recursive: true });
  await writeFile(path.join(root, "docs", "index.html"), "<h1>Docs</h1>");
  await writeFile(
    path.join(root, "docs", "start", "index.html"),
    "<h1>Install</h1>",
  );
  await assert.rejects(checkSearch(root), /no search index/);
  await mkdir(path.join(root, "pagefind"));
  await writeFile(
    path.join(root, "pagefind", "pagefind-entry.json"),
    JSON.stringify({ languages: { en: { page_count: 1 } } }),
  );
  await writeFile(path.join(root, "pagefind", "pagefind.js"), "export {};");
  await assert.rejects(
    checkSearch(root),
    /2 documentation pages and 1 indexed/,
  );
  await writeFile(
    path.join(root, "pagefind", "pagefind-entry.json"),
    JSON.stringify({ languages: { en: { page_count: 2 } } }),
  );
  assert.equal(await checkSearch(root), 2);
});
