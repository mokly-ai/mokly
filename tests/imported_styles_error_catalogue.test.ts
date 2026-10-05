import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import { repositoryRoot } from "./helpers/fixture.js";

function normalized(value: string): string {
  return value.replaceAll("\\n", " ").replace(/\s+/gu, " ").trim();
}

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(file)));
    else if (/\.[cm]?[jt]sx?$/u.test(entry.name)) files.push(file);
  }
  return files;
}

function literalText(source: string, file: string): string {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const literals: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      literals.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return normalized(literals.join(" "));
}

test("every imported-styles error template has a source message", async () => {
  const catalogue = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-imported-styles-errors.md"),
    "utf8",
  );
  const templates = catalogue
    .split("\n")
    .filter((line) => line.startsWith("|") && line.includes("`"))
    .map((line) => [...line.matchAll(/`([^`]+)`/gu)].at(-1)?.[1])
    .filter((value): value is string => value !== undefined)
    .filter((value) => value.length > 25);
  const corpora = await Promise.all(
    (await sourceFiles(path.join(repositoryRoot, "src"))).map(async (file) =>
      literalText(await fs.readFile(file, "utf8"), file),
    ),
  );
  const missing = templates.filter((template) => {
    const fragments = template
      .split(/\{[^{}]+\}/gu)
      .map(normalized)
      .filter((fragment) => fragment.length >= 12);
    return !corpora.some((corpus) =>
      fragments.every((fragment) => corpus.includes(fragment)),
    );
  });
  assert.ok(templates.length > 40, `only ${templates.length} messages checked`);
  assert.deepEqual(missing, []);
});
