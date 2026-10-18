import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";

import { command, publicationFixture } from "./static_publication.js";

const exec = promisify(execFile);
export async function git(root: string, ...args: string[]) {
  return (await exec("git", args, { cwd: root })).stdout.trim();
}
export async function write(root: string, name: string, text: string) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(path.join(root, name), text);
}
export const screen = (body: string, extra = "") =>
  `---\ntitle: Home\n${extra}---\n${body}`;
export async function fixture() {
  const root = await publicationFixture();
  await write(root, "mokly.config.json", '{"review":{"base":"fixture-base"}}');
  await write(
    root,
    "specs/home.screen.html",
    screen('<h1>Before</h1><img src="../../logo.svg">'),
  );
  await write(
    root,
    "logo.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"><title>Before asset</title></svg>',
  );
  await write(
    root,
    "specs/retired.screen.html",
    screen("<h1>Retired screen</h1>"),
  );
  await write(
    root,
    "specs/old.page.html",
    '---\ntitle: Old page\n---\n<!doctype html><html><head></head><body>Old page<img src="../../logo.svg"></body></html>',
  );
  await write(root, "specs/old-note.md", "# Old note\n\nHistorical document\n");
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "base catalogue");
  await git(root, "branch", "fixture-base");
  const base = await git(root, "rev-parse", "HEAD");
  await write(
    root,
    "specs/home.screen.html",
    screen('<h1>After</h1><img src="../../logo.svg">'),
  );
  await write(
    root,
    "logo.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"><title>After asset</title></svg>',
  );
  for (const name of ["retired.screen.html", "old.page.html", "old-note.md"])
    await fs.rm(path.join(root, "specs", name));
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "changed catalogue");
  return { root, base };
}
export async function build(
  root: string,
  extra: string[] = [],
  mode = "rich",
  signal?: AbortSignal,
) {
  const result = await command(
    root,
    "build",
    ["--out=.context/site", ...extra],
    mode,
    {},
    signal,
  ).result;
  assert.equal(result.code, 0, result.stderr);
  const output = path.join(root, ".context/site");
  const index = await json<CatalogueReadModel>(
    output,
    "mokly-viewer/index.json",
  );
  readCatalogueIndex(index);
  return { ...result, output, index };
}
export async function json<T>(root: string, file: string) {
  return JSON.parse(await fs.readFile(path.join(root, file), "utf8")) as T;
}
