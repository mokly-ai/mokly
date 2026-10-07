import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import { braceExpand, minimatch } from "minimatch";

import { evaluateDependencyAudit } from "../scripts/verification/dependency-audit-evaluation.mjs";

import { auditFixture, issueMessages } from "./helpers/dependency_audit.js";

interface ShellQuoteModule {
  quote(tokens: readonly (string | { comment: string })[]): string;
  parse(command: string): unknown[];
}

test("shell quoting rejects line terminators after a comment token", () => {
  const shellQuote = createRequire(import.meta.url)(
    "shell-quote",
  ) as ShellQuoteModule;
  for (const separator of ["\n", "\r", "\u2028", "\u2029"])
    assert.throws(
      () =>
        shellQuote.quote([
          "echo",
          "ok",
          { comment: "note" },
          `a${separator}echo injected;#`,
        ]),
      TypeError,
    );
  assert.deepEqual(
    shellQuote.parse(shellQuote.quote(["echo", "ordinary argument"])),
    ["echo", "ordinary argument"],
  );
});

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
  assert.equal(result.ok, true, issueMessages(result));
});

/** One `package` X.Y.Z claim; a floor also accepts newer releases. */
interface VersionClaim {
  name: string;
  version: string;
  floor: boolean;
}

/** The lockfile install entries that version claims are checked against. */
interface Lockfile {
  packages: Record<string, { version?: string }>;
}

/** Read each backticked package name, optional link, and named version. */
function versionClaims(markdown: string): VersionClaim[] {
  return [
    ...markdown.matchAll(
      /`(@?[a-z0-9][\w.-]*(?:\/[\w.-]+)?)`(?:\]\([^)\s]*\))?\s+(\d+\.\d+\.\d+)\b(\s+or\s+newer)?/gu,
    ),
  ].map(([, name = "", version = "", newer]) => ({
    name,
    version,
    floor: newer !== undefined,
  }));
}

/** Order two versions by their numeric major, minor, and patch parts. */
function compareRelease(left: string, right: string): number {
  const parts = (version: string) =>
    version.split(/[.+-]/u).slice(0, 3).map(Number);
  const expected = parts(right);
  return parts(left).reduce(
    (order, part, index) => order || part - (expected[index] ?? 0),
    0,
  );
}

/** Every locked version of `name`, at the root or nested under a parent. */
function lockedVersions(lockfile: Lockfile, name: string): string[] {
  return Object.entries(lockfile.packages).flatMap(([location, entry]) =>
    (location === `node_modules/${name}` ||
      location.endsWith(`/node_modules/${name}`)) &&
    entry.version !== undefined
      ? [entry.version]
      : [],
  );
}

test("policy version claims read links, scopes, wrapping, and floors", () => {
  assert.deepEqual(
    versionClaims(
      "[`marked`](https://example.test/marked) 18.1.0, `@scope/pkg`\n  2.0.1 or newer, `range >=1.0.0` and `pkg` 0.9 later.",
    ),
    [
      { name: "marked", version: "18.1.0", floor: false },
      { name: "@scope/pkg", version: "2.0.1", floor: true },
    ],
  );
  assert.ok(compareRelease("10.10.0", "10.2.6") > 0);
  assert.ok(compareRelease("10.2.5", "10.2.6") < 0);
});

test("the dependency policy names versions that the lockfile installs", async () => {
  const root = new URL("../", import.meta.url);
  const [policy, lockfile] = await Promise.all([
    fs.readFile(new URL("docs/protocol/dependency-security.md", root), "utf8"),
    fs
      .readFile(new URL("package-lock.json", root), "utf8")
      .then((text) => JSON.parse(text) as Lockfile),
  ]);
  const claims = versionClaims(policy);
  assert.ok(claims.length > 0, "the policy must name its locked versions");
  const stale = claims.flatMap(({ name, version, floor }) => {
    const locked = lockedVersions(lockfile, name);
    const installed = locked.some((candidate) =>
      floor ? compareRelease(candidate, version) >= 0 : candidate === version,
    );
    return installed
      ? []
      : [
          `${name} ${version}${floor ? " or newer" : ""}; locked: ${locked.join(", ") || "none"}`,
        ];
  });
  assert.deepEqual(stale, []);
});
