import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
    (file === "AGENTS.md" ||
      file.startsWith("docs/") ||
      path.basename(file) === "README.md"),
);
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
  const result: string[] = [];
  const lines = text.split("\n");
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (
      let start = line.indexOf("](");
      start !== -1;
      start = line.indexOf("](", start + 2)
    ) {
      let depth = 1;
      let end = start + 2;
      for (; end < line.length && depth; end++) {
        if (line[end] === "(" && line[end - 1] !== "\\") depth++;
        if (line[end] === ")" && line[end - 1] !== "\\") depth--;
      }
      if (!depth) result.push(line.slice(start + 2, end - 1).split(/\s+"/)[0]!);
    }
    const definition = /^\s*\[[^\]]+\]:\s*<?([^>\s]+)>?/.exec(line);
    if (definition) result.push(definition[1]!);
  }
  return result;
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

test("local documentation links resolve and anchors match GitHub headings", async () => {
  const failures: string[] = [];
  let protocolLinks = 0;
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
  assert.deepEqual(failures, []);
});
