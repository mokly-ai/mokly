import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import { braceExpand, minimatch } from "minimatch";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture } from "./helpers/dependency_audit.js";

test("catalogue globs retain ordinary brace alternatives and padded ranges", () => {
  assert.deepEqual(braceExpand("screens/{account,billing}/step-{01..03}.tsx"), [
    "screens/account/step-01.tsx",
    "screens/account/step-02.tsx",
    "screens/account/step-03.tsx",
    "screens/billing/step-01.tsx",
    "screens/billing/step-02.tsx",
    "screens/billing/step-03.tsx",
  ]);
  assert.equal(
    minimatch(
      "screens/billing/step-02.tsx",
      "screens/{account,billing}/**/*.tsx",
    ),
    true,
  );
});

test("glob expansion bounds total padded output, not just result count", () => {
  const first = `${"0".repeat(256)}1`;
  const expanded = braceExpand(`{${first}..100000}`);

  assert.equal(expanded[0], first);
  assert.ok(expanded.length > 1);
  assert.ok(
    expanded.reduce((length, value) => length + value.length, 0) <= 4_000_000,
    "padded sequences must respect the dependency's aggregate expansion budget",
  );
});

/** The quoting surface React Devtools resolves from its dependency tree. */
interface ShellQuoteModule {
  quote(tokens: readonly (string | { comment: string })[]): string;
}

function devtoolsShellQuote(): ShellQuoteModule {
  const devtoolsEntry = createRequire(import.meta.url).resolve(
    "react-devtools-core",
  );
  return createRequire(devtoolsEntry)("shell-quote") as ShellQuoteModule;
}

test("Devtools shell quoting preserves ordinary words and comments", () => {
  const { quote } = devtoolsShellQuote();
  assert.equal(quote(["echo", "two words"]), "echo 'two words'");
  assert.equal(quote(["echo", { comment: "note" }]), "echo #note");
});

test("Devtools shell quoting rejects line terminators after comments", () => {
  const { quote } = devtoolsShellQuote();
  for (const terminator of ["\n", "\r", "\u2028", "\u2029"])
    assert.throws(
      () => quote(["echo", { comment: "note" }, `value${terminator}suffix`]),
      TypeError,
    );
});

/** The consumer surface PostCSS uses to read and apply a previous source map. */
interface SourceMapModule {
  SourceMapConsumer: new (map: string) => {
    eachMapping(
      callback: (mapping: {
        generatedLine: number;
        source: string | null;
      }) => void,
    ): void;
  };
}

/** Load the exact `source-map-js` copy that the runtime PostCSS resolves. */
function postcssSourceMap(): SourceMapModule {
  const postcssEntry = createRequire(import.meta.url).resolve("postcss");
  return createRequire(postcssEntry)("source-map-js") as SourceMapModule;
}

/** Serialize an indexed map with one single-mapping section per offset line. */
function indexedSourceMap(offsetLines: readonly number[]): string {
  return JSON.stringify({
    version: 3,
    sections: offsetLines.map((line, index) => ({
      offset: { line, column: 0 },
      map: {
        version: 3,
        sources: [`section-${index}.css`],
        names: [],
        mappings: "AAAA",
      },
    })),
  });
}

test("PostCSS source maps keep ordinary indexed section offsets", () => {
  const { SourceMapConsumer } = postcssSourceMap();
  const consumer = new SourceMapConsumer(indexedSourceMap([0, 2]));
  const mappings: Array<[number, string | null]> = [];
  consumer.eachMapping(({ generatedLine, source }) =>
    mappings.push([generatedLine, source]),
  );

  assert.deepEqual(mappings, [
    [1, "section-0.css"],
    [3, "section-1.css"],
  ]);
});

test("PostCSS source maps reject section offsets beyond the line budget", () => {
  const { SourceMapConsumer } = postcssSourceMap();

  assert.throws(
    () => new SourceMapConsumer(indexedSourceMap([1_000_000_000])),
    /Section offset line must not exceed 10000000/,
  );
});

test("reviewed exception data covers the captured report with the real lockfile", async () => {
  const root = new URL("../", import.meta.url);
  const [exceptions, lockfile, metadata] = await Promise.all([
    fs
      .readFile(
        new URL("scripts/verification/dependency-audit-exceptions.json", root),
        "utf8",
      )
      .then(JSON.parse),
    fs.readFile(new URL("package-lock.json", root), "utf8").then(JSON.parse),
    fs.readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  ]);
  const { report, exception, today } = auditFixture();
  assert.equal(exceptions.length, 1);
  for (const field of ["advisory", "package", "path", "until"] as const)
    assert.deepEqual(exceptions[0][field], exception[field]);
  assert.equal(
    metadata.scripts["dependencies:check"],
    "node scripts/verification/dependency-audit.mjs",
  );
  const result = evaluateDependencyAudit(report, lockfile, exceptions, today);
  assert.equal(result.ok, true, result.errors.join("\n"));
});
