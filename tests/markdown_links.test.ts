import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { Marked, type Token } from "marked";

import { repositoryRoot } from "./helpers/fixture.js";

const listed = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repositoryRoot, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const markdown = listed.filter(
  (file) =>
    file.endsWith(".md") &&
    (file.startsWith("docs/") ||
      file.startsWith("plans/") ||
      path.basename(file) === "README.md"),
);
const parser = new Marked({ gfm: true });
const contents = new Map<string, string>();

async function read(file: string): Promise<string> {
  let content = contents.get(file);
  if (content === undefined) {
    content = await fs.readFile(path.join(repositoryRoot, file), "utf8");
    contents.set(file, content);
  }
  return content;
}

function links(text: string): string[] {
  const tokens = parser.lexer(text);
  const result = new Set(Object.values(tokens.links).map((link) => link.href));
  parser.walkTokens(tokens, (token: Token) => {
    if (token.type === "link" || token.type === "image") result.add(token.href);
  });
  return [...result];
}

function anchors(text: string): Set<string> {
  const found = new Set<string>();
  const repeated = new Map<string, number>();
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const heading = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1];
    if (!heading) continue;
    const slug = heading
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const count = repeated.get(slug) ?? 0;
    repeated.set(slug, count + 1);
    found.add(count ? `${slug}-${count}` : slug);
  }
  for (const match of text.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/g))
    found.add(match[1]!);
  return found;
}

test("a Markdown parser decides which text is a link", () => {
  assert.deepEqual(links("`[a](a.md)` ``[b](`b`)`` [c](c.md)"), ["c.md"]);
  assert.deepEqual(links("an unclosed ` [d](d.md)"), ["d.md"]);
  assert.deepEqual(links("`a span that\nwraps [e](e.md)` [f](f.md)"), ["f.md"]);
  assert.deepEqual(links("`a wrapped\nspan` [g](g.md) `h`"), ["g.md"]);
  assert.deepEqual(links("\\` [i](i.md) \\`"), ["i.md"]);
  assert.deepEqual(links("```\n[j](j.md)\n```"), []);
  assert.deepEqual(links('![k](k.png) [l](l.md "Title")'), ["k.png", "l.md"]);
  assert.deepEqual(links("[m][ref]\n\n[ref]: m.md"), ["m.md"]);
});

test("local documentation and plan links resolve and anchors match GitHub headings", async () => {
  const failures: string[] = [];
  let protocolLinks = 0;
  let planLinks = 0;
  for (const source of markdown) {
    for (const destination of links(await read(source))) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(destination)) continue;
      const [relative, hash] = destination.split("#", 2);
      if (!relative && !hash) continue;
      const candidate = relative
        ? path.resolve(
            repositoryRoot,
            path.dirname(source),
            decodeURIComponent(relative),
          )
        : path.join(repositoryRoot, source);
      let target = path
        .relative(repositoryRoot, candidate)
        .split(path.sep)
        .join("/");
      if (target.startsWith("..")) continue;
      if ((await fs.stat(candidate).catch(() => undefined))?.isDirectory()) {
        if (!hash) continue;
        target = path.posix.join(target, "README.md");
      }
      if (target.startsWith("docs/protocol/")) protocolLinks++;
      if (source.startsWith("plans/")) planLinks++;
      const exists = await fs
        .stat(path.join(repositoryRoot, target))
        .catch(() => undefined);
      if (!exists?.isFile()) {
        failures.push(`${source} -> ${destination}: missing file`);
        continue;
      }
      if (
        hash &&
        target.endsWith(".md") &&
        !anchors(await read(target)).has(decodeURIComponent(hash))
      )
        failures.push(`${source} -> ${destination}: missing anchor`);
    }
  }
  assert.ok(
    protocolLinks > 100,
    `only ${protocolLinks} protocol links checked`,
  );
  assert.ok(planLinks > 100, `only ${planLinks} plan links checked`);
  assert.deepEqual(failures, []);
});
