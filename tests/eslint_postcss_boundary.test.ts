import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);
const eslint = new ESLint({ cwd: repositoryRoot });
const boundary = "src/build/styles/postcss_boundary.ts";
const guardedRules = [
  "@typescript-eslint/no-restricted-imports",
  "no-restricted-syntax",
];
const boundaryMessage =
  /src\/build\/styles\/postcss_boundary\.ts, which disables PostCSS source maps/;

async function violations(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages
    .filter((message) => guardedRules.includes(message.ruleId ?? ""))
    .map((message) => message.message);
}

const bypasses = {
  "default import":
    'import postcss from "postcss";\nexport const root = postcss.parse("a{}", { from: "a.css" });\n',
  "parse import":
    'import { parse } from "postcss";\nexport const root = parse("a{}");\n',
  "plugin import":
    'import { plugin } from "postcss";\nexport const creator = plugin("fixture", () => () => {});\n',
  "Processor import":
    'import { Processor } from "postcss";\nexport const processor = new Processor([]);\n',
  "Input import":
    'import { Input } from "postcss";\nexport const input = new Input("a{}");\n',
  "namespace import":
    'import * as postcss from "postcss";\nexport const root = postcss.parse("a{}");\n',
  "re-export": 'export { parse } from "postcss";\n',
  "internal module":
    'import Input from "postcss/lib/input";\nexport const input = new Input("a{}");\n',
  "dynamic import": 'export const postcss = await import("postcss");\n',
  "require call":
    'import { createRequire } from "node:module";\nexport const postcss: unknown = createRequire(import.meta.url)("postcss");\n',
};

test("ESLint keeps PostCSS parsing and processing behind the source-map boundary", async () => {
  for (const filePath of [
    "src/build/styles/fixture.ts",
    "src/server/fixture.ts",
    "packages/viewer/src/fixture.ts",
  ])
    for (const [name, code] of Object.entries(bypasses)) {
      const messages = await violations(code, filePath);
      assert.equal(messages.length, 1, `${name} in ${filePath}`);
      assert.match(messages[0]!, boundaryMessage);
    }
});

test("ESLint allows PostCSS types, nodes, errors and plugin packages", async () => {
  const code = [
    'import { createRequire } from "node:module";',
    'import { CssSyntaxError, Rule, type Root } from "postcss";',
    'import type { Processor } from "postcss";',
    "export type Parsed = [Root, Processor];",
    'export const rule = new Rule({ selector: ".a" });',
    "export const failure = CssSyntaxError;",
    'export const plugin: unknown = createRequire(import.meta.url)("postcss-modules-scope");',
  ].join("\n");
  assert.deepEqual(await violations(code, "src/build/styles/fixture.ts"), []);
});

test("ESLint lets the boundary and tests load PostCSS in every form", async () => {
  for (const filePath of [boundary, "tests/fixture.test.ts"])
    for (const [name, code] of Object.entries(bypasses))
      assert.deepEqual(
        await violations(code, filePath),
        [],
        `${name} in ${filePath}`,
      );
});

test("ESLint keeps locale path sorting checks beside PostCSS load checks", async () => {
  for (const filePath of ["src/build/styles/fixture.ts", boundary]) {
    const messages = await violations(
      'export const paths = ["b", "a"].sort((a, b) => a.localeCompare(b));\n',
      filePath,
    );
    assert.equal(messages.length, 1, filePath);
    assert.match(messages[0]!, /compareCodeUnits/);
  }
});

/** One import path, import pattern or syntax selector of a restriction rule. */
interface Restriction {
  readonly message?: string;
  readonly paths?: readonly Restriction[];
  readonly patterns?: readonly Restriction[];
}

/** Resolved rule entries, as `[severity, ...options]`, for one file. */
interface ResolvedConfig {
  readonly rules?: Readonly<Record<string, unknown>>;
}

/** Entries of an enabled restriction rule, with import option lists flattened. */
function restrictions(rule: unknown): Restriction[] {
  if (!Array.isArray(rule) || rule[0] !== 2) return [];
  return rule
    .slice(1)
    .flatMap((option: Restriction) =>
      option.paths || option.patterns
        ? [...(option.paths ?? []), ...(option.patterns ?? [])]
        : [option],
    );
}

/** The PostCSS guard entries that ESLint resolves for one file. */
async function postcssGuards(filePath: string): Promise<Restriction[]> {
  const config = (await eslint.calculateConfigForFile(filePath)) as
    ResolvedConfig | undefined;
  assert.ok(config?.rules, `ESLint must lint ${filePath}`);
  return guardedRules
    .flatMap((rule) => restrictions(config.rules?.[rule]))
    .filter((entry) => boundaryMessage.test(entry.message ?? ""));
}

/** Tracked TypeScript and JavaScript files under the product source roots. */
async function productSources(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-z", "--", "src", "packages"],
    { cwd: repositoryRoot },
  );
  return stdout
    .split("\0")
    .filter((file) =>
      /^(?:src|packages\/[^/]+\/src)\/.+\.[cm]?[jt]sx?$/.test(file),
    );
}

test("ESLint applies the PostCSS guard to every tracked product source", async () => {
  const reference = await postcssGuards("src/server/fixture.ts");
  assert.notDeepEqual(reference, []);
  const sources = await productSources();
  assert.ok(sources.includes(boundary), boundary);
  for (const filePath of sources)
    assert.deepEqual(
      await postcssGuards(filePath),
      filePath === boundary ? [] : reference,
      filePath,
    );
});
