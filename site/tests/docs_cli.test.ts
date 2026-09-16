import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DOCS_PAGES } from "../src/docs/pages.js";
import { repositoryPath } from "../src/workspace.js";

/**
 * The CLI reference is verified against the code rather than read. Options are
 * documented in the first column of a table, as one code span, so this test
 * knows exactly what the reference claims the CLI accepts.
 */

/** Process options the CLI keeps to itself, named by `docs/protocol/site-docs.md`. */
const HIDDEN = ["--retained-runtime", "--strict-port", "--update-version"];

const parser = readFileSync(
  repositoryPath("src", "cli", "arguments.ts"),
  "utf8",
);
const help = readFileSync(repositoryPath("src", "cli", "help.ts"), "utf8");
const errors = readFileSync(repositoryPath("src", "errors.ts"), "utf8");
const baselineErrors = readFileSync(
  repositoryPath("src", "baseline", "errors.ts"),
  "utf8",
);

const pages = DOCS_PAGES.filter((page) => page.section === "cli");
const sources = new Map(
  pages.map((page) => [page.id, readFileSync(page.source, "utf8")]),
);

function firstCells(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|")[1]?.trim() ?? "");
}

function codeSpan(cell: string): string | undefined {
  const match = /^`([^`]+)`$/.exec(cell);
  return match?.[1];
}

function documentedOptions(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const source of sources.values()) {
    for (const cell of firstCells(source)) {
      const span = codeSpan(cell);
      const token = span?.split(/\s+/)[0] ?? "";
      if (/^--?[a-z][a-z-]*$/.test(token)) found.add(token);
    }
  }
  return found;
}

function parserOptions(): ReadonlySet<string> {
  return new Set(
    [...parser.matchAll(/"(--?[a-z][a-z-]*)"/g)].map(
      ([, option]) => option ?? "",
    ),
  );
}

function commands(): readonly string[] {
  const block = /const COMMANDS = new Set<CliCommand>\(\[([\s\S]*?)\]\)/.exec(
    parser,
  );
  return [...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)]
    .map(([, name]) => name ?? "")
    .filter((name) => !name.startsWith("__"));
}

function errorCategories(): readonly string[] {
  const union = (source: string, name: string): string[] => {
    const block = new RegExp(`export type ${name} =([\\s\\S]*?);`).exec(source);
    return [...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      ([, code]) => code ?? "",
    );
  };
  return [
    ...union(baselineErrors, "BaselineErrorCode"),
    ...union(errors, "MoklyErrorCode"),
  ];
}

test("every command has its own page in the CLI reference", () => {
  const documented = pages
    .map((page) => page.id.slice("cli/".length))
    .filter((slug) => slug !== "options-and-exit-status");
  assert.deepEqual([...documented].sort(), [...commands()].sort());
});

test("every documented option exists in the parser and in the CLI help", () => {
  const known = parserOptions();
  const documented = documentedOptions();
  assert.ok(documented.size > 10, "the reference documents the CLI options");
  for (const option of documented) {
    assert.ok(known.has(option), `${option} is documented but not parsed`);
    assert.ok(
      help.includes(option),
      `${option} is documented but not in --help`,
    );
  }
});

test("every public option in the parser is documented", () => {
  const documented = documentedOptions();
  for (const option of parserOptions()) {
    if (HIDDEN.includes(option)) continue;
    assert.ok(documented.has(option), `${option} is parsed but not documented`);
  }
});

test("the hidden process options are documented nowhere", () => {
  for (const option of HIDDEN) {
    assert.ok(parserOptions().has(option), `${option} left the parser`);
    for (const [id, source] of sources) {
      assert.ok(!source.includes(option), `${id} names the hidden ${option}`);
    }
  }
});

test("exit status and every error category are documented", () => {
  const source = sources.get("cli/options-and-exit-status") ?? "";
  const documented = firstCells(source)
    .map((cell) => codeSpan(cell))
    .filter((span): span is string => span !== undefined);
  assert.ok(documented.includes("0"), "success is documented");
  assert.ok(documented.includes("1"), "failure is documented");
  const categories = errorCategories();
  assert.ok(categories.length > 0, "the code declares error categories");
  for (const category of categories) {
    assert.ok(documented.includes(category), `${category} is not documented`);
  }
  for (const span of documented) {
    if (span === "0" || span === "1" || span.startsWith("-")) continue;
    if (!span.includes(" ") && span.includes("-")) {
      assert.ok(
        categories.includes(span),
        `${span} is documented but is not an error category`,
      );
    }
  }
  assert.ok(source.includes("[mokly/"), "the prefix a reader sees is shown");
});
