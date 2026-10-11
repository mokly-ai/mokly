import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  parseProtocolCapTable,
  protocolCapAudit,
} from "../scripts/verification/repository-ratchets.mjs";

const label = "xtask/protocol-document-caps.json";
const legacyTable = "tests/protocol_doc_sizes.test.ts";
const longDocument = "docs/protocol/long.md";
const lines = (count: number) => "line\n".repeat(count);

test("a sorted JSON cap table parses into exact caps", () => {
  assert.deepEqual(
    parseProtocolCapTable(
      Buffer.from('{\n  "a.md": 251,\n  "nested/b.md": 300\n}\n'),
      label,
    ),
    { "a.md": 251, "nested/b.md": 300 },
  );
  assert.deepEqual(parseProtocolCapTable("{}\n", label), {});
});

const invalidTables: ReadonlyArray<readonly [string, string, RegExp]> = [
  ["unsorted keys", '{ "b.md": 300, "a.md": 300 }', /not sorted: a\.md/u],
  ["a repeated key", '{ "a.md": 300, "a.md": 301 }', /repeats.*a\.md$/u],
  ["an escaped repeat", '{ "a.md": 300, "a\\u002emd": 301 }', /repeats/u],
  ["a fractional cap", '{ "a.md": 300.5 }', /invalid cap for a\.md/u],
  ["a string cap", '{ "a.md": "300" }', /invalid cap for a\.md/u],
  ["an unsafe cap", '{ "a.md": 9007199254740993 }', /invalid cap/u],
  ["a cap at 250", '{ "a.md": 250 }', /invalid cap for a\.md/u],
  ["a cap below 250", '{ "a.md": 120 }', /invalid cap for a\.md/u],
  ["an array document", '[{ "a.md": 300 }]', /one JSON object/u],
  ["a null document", "null", /one JSON object/u],
  ["a number document", "300", /one JSON object/u],
  ["a parent path key", '{ "../README.md": 300 }', /docs\/protocol/u],
  ["an absolute path key", '{ "/a.md": 300 }', /docs\/protocol/u],
  ["an empty segment key", '{ "nested//a.md": 300 }', /docs\/protocol/u],
  ["a non-Markdown key", '{ "a.txt": 300 }', /docs\/protocol/u],
  ["invalid JSON", '{ "a.md": 300, }', /not valid JSON/u],
];

for (const [name, source, reason] of invalidTables)
  test(`a cap table with ${name} fails with the file label`, () => {
    assert.throws(
      () => parseProtocolCapTable(source, label),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith(`${label} `) &&
        reason.test(error.message),
    );
  });

/** A repository whose one commit holds `files` and is also `origin/main`. */
async function capRepository(
  context: TestContext,
  files: Readonly<Record<string, string>>,
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-cap-table-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  for (const [file, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), contents);
  }
  git("add", ".");
  git("commit", "-qm", "comparison commit");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { git, root };
}

test("the cap ratchet reads the legacy table at an older comparison commit", async (context) => {
  const { git, root } = await capRepository(context, {
    [longDocument]: lines(270),
    [legacyTable]: 'const oversizedCaps = { "long.md": 260 };\n',
  });
  await fs.rm(path.join(root, legacyTable));
  assert.throws(() => protocolCapAudit(root), {
    message: `${label} is missing`,
  });

  await fs.mkdir(path.join(root, "xtask"));
  await fs.writeFile(path.join(root, longDocument), lines(265));
  await fs.writeFile(path.join(root, label), '{ "long.md": 265 }\n');
  git("add", "--all");
  git("commit", "-qm", "JSON cap table");
  assert.deepEqual(protocolCapAudit(root).findings, [
    "long.md: cap 265 exceeds predecessor long.md cap 260",
  ]);
  await fs.writeFile(path.join(root, longDocument), lines(260));
  await fs.writeFile(path.join(root, label), '{ "long.md": 260 }\n');
  assert.deepEqual(protocolCapAudit(root).findings, []);
});

test("the cap ratchet prefers the JSON table at the comparison commit", async (context) => {
  const { root } = await capRepository(context, {
    [longDocument]: lines(280),
    [label]: '{ "long.md": 260 }\n',
    [legacyTable]: 'const oversizedCaps = { "long.md": 270 };\n',
  });
  await fs.writeFile(path.join(root, longDocument), lines(265));
  await fs.writeFile(path.join(root, label), '{ "long.md": 265 }\n');
  assert.deepEqual(protocolCapAudit(root).findings, [
    "long.md: cap 265 exceeds predecessor long.md cap 260",
  ]);
});
