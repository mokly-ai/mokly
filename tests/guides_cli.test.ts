import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { GUIDES } from "./helpers/guides.js";

const HIDDEN = ["--retained-runtime", "--strict-port", "--update-version"];
const parser = readFileSync(
  path.join(repositoryRoot, "src", "cli", "arguments.ts"),
  "utf8",
);
const help = readFileSync(
  path.join(repositoryRoot, "src", "cli", "help.ts"),
  "utf8",
);
const errors = readFileSync(
  path.join(repositoryRoot, "src", "errors.ts"),
  "utf8",
);
const baselineErrors = readFileSync(
  path.join(repositoryRoot, "src", "baseline", "errors.ts"),
  "utf8",
);
const pages = GUIDES.filter((page) => page.frontmatter.section === "cli");
const sources = new Map(pages.map((page) => [page.id, page.source]));

function firstCells(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|")[1]?.trim() ?? "");
}

function codeSpan(cell: string): string | undefined {
  return /^`([^`]+)`$/u.exec(cell)?.[1];
}

function documentedOptions(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const source of sources.values()) {
    for (const cell of firstCells(source)) {
      const token = codeSpan(cell)?.split(/\s+/u)[0] ?? "";
      if (/^--?[a-z][a-z-]*$/u.test(token)) found.add(token);
    }
  }
  return found;
}

function parserOptions(): ReadonlySet<string> {
  return new Set(
    [...parser.matchAll(/"(--?[a-z][a-z-]*)"/gu)].map(
      ([, option]) => option ?? "",
    ),
  );
}

function commands(): readonly string[] {
  const block = /const COMMANDS = new Set<CliCommand>\(\[([\s\S]*?)\]\)/u.exec(
    parser,
  );
  return [...(block?.[1] ?? "").matchAll(/"([^"]+)"/gu)]
    .map(([, name]) => name ?? "")
    .filter((name) => !name.startsWith("__"));
}

function errorCategories(): readonly string[] {
  const union = (source: string, name: string): string[] => {
    const block = new RegExp(`export type ${name} =([\\s\\S]*?);`, "u").exec(
      source,
    );
    return [...(block?.[1] ?? "").matchAll(/"([^"]+)"/gu)].map(
      ([, code]) => code ?? "",
    );
  };
  return [
    ...union(baselineErrors, "BaselineErrorCode"),
    ...union(errors, "MoklyErrorCode"),
  ];
}

test("every public command has one CLI guide", () => {
  const documented = pages
    .map((page) => page.slug)
    .filter((slug) => slug !== "options-and-exit-status");
  assert.deepEqual([...documented].sort(), [...commands()].sort());
});

test("documented and parsed public options agree with CLI help", () => {
  const known = parserOptions();
  const documented = documentedOptions();
  assert.ok(documented.size > 10);
  for (const option of documented) {
    assert.ok(known.has(option), `${option} is documented but not parsed`);
    assert.ok(
      help.includes(option),
      `${option} is documented but not in --help`,
    );
  }
  for (const option of known) {
    if (!HIDDEN.includes(option))
      assert.ok(
        documented.has(option),
        `${option} is parsed but not documented`,
      );
  }
  for (const option of HIDDEN) {
    assert.ok(known.has(option), `${option} left the parser`);
    for (const [id, source] of sources)
      assert.ok(!source.includes(option), `${id} names hidden ${option}`);
  }
});

test("exit status and every public error category are documented", () => {
  const source = sources.get("cli/options-and-exit-status") ?? "";
  const documented = firstCells(source)
    .map(codeSpan)
    .filter((span): span is string => span !== undefined);
  assert.ok(documented.includes("0"));
  assert.ok(documented.includes("1"));
  const categories = errorCategories();
  assert.ok(categories.length > 0);
  for (const category of categories)
    assert.ok(documented.includes(category), `${category} is not documented`);
  for (const span of documented) {
    if (span === "0" || span === "1" || span.startsWith("-")) continue;
    if (!span.includes(" ") && span.includes("-"))
      assert.ok(categories.includes(span), `${span} is not an error category`);
  }
  assert.ok(source.includes("[mokly/"));
});
