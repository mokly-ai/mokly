import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

const publicDirectory = resolve(repositoryRoot, "packages/app/public");

/** The `href` of every `<link rel="icon">` in the application's document. */
function iconLinks(document: string): string[] {
  return [...document.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\brel="icon"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1] ?? "");
}

test("the document links a tab icon that the public directory serves", () => {
  const document = readFileSync(resolve(publicDirectory, "index.html"), "utf8");
  const links = iconLinks(document);
  assert.equal(links.length, 1, "the document links exactly one icon");
  const href = links[0] as string;
  assert.ok(href.startsWith("/"), `${href} must be root-relative`);
  const path = resolve(publicDirectory, href.slice(1));
  assert.ok(existsSync(path), `the public directory has no ${href}`);
  assert.match(
    readFileSync(path, "utf8"),
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
  );
});
