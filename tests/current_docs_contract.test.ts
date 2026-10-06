import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  currentDocs,
  docStatements,
  docsFindings,
  isCurrentDoc,
  type DocException,
} from "./helpers/current_docs.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

const fixture = async (name: string) =>
  JSON.parse(
    await fs.readFile(path.join(import.meta.dirname, "fixtures", name), "utf8"),
  );

test("current docs allow restricted statements only in delivery status or exact reviewed exceptions", async () => {
  const exceptions = (await fixture(
    "current-docs-allowlist.json",
  )) as DocException[];
  assert.deepEqual(
    docsFindings(await currentDocs(repositoryRoot), exceptions),
    [],
  );
});

test("verbatim review findings fail outside delivery status, across line breaks", async () => {
  const cases = (await fixture("current-docs-stale.json")) as Array<{
    file: string;
    revision: string;
    line: number;
    statement: string;
  }>;
  for (const item of cases) {
    const findings = docsFindings(docStatements(item.file, item.statement), []);
    assert.ok(
      findings.length > 0,
      `${item.revision}:${item.file}:${item.line}: ${item.statement}`,
    );
    assert.ok(findings[0]!.startsWith(`${item.file}:`));
  }
});

test("a removal word does not waive another statement or a fenced input", () => {
  for (const text of [
    "Former manifest v5 is rejected.",
    "Current manifest v7 never reads older output.",
    "Catalogue v3 omits removed fields.",
    "Comparison v4 includes no legacy evidence.",
    'The removed field is ignored.\nownedDependencies: ["file.css"]',
    '```ts\nconst input = {\n  dependencies:\n    ["source.ts"],\n};\n```',
    "```ts\ninterface Input { dependencies?:never; }\n```",
    "The implementation\nplan is complete.",
    "Milestone\n30 is implemented.",
    "Current review result v5 still uses manifest v5.",
    "The public v4 manifest omits old fields.",
    "The public v4 comparison is current.",
    "Upload v1 keeps sharedImpact fields.",
    '```json\n{ "dependencies": ["source.ts"] }\n```',
    "The `details.dependencies` field is current.",
    "An entry's dependencies give evidence.",
  ])
    assert.ok(
      docsFindings(docStatements("docs/protocol/test.md", text), []).length > 0,
      text,
    );
});

test("delivery sections end at equal or higher headings and fences cannot open them", () => {
  for (const title of [
    "## Delivery Status",
    "Delivery Status\n---------------",
  ]) {
    const statements = docStatements(
      "src/example/README.md",
      `${title}\n\nMilestone 30 is complete.\n\n### History\n\nManifest v5 was used.\n\n## Current\n\nManifest\nv5 is current.\n\n# Other\n\nsharedImpact is accepted.`,
    );
    assert.equal(docsFindings(statements, []).length, 2);
  }
  assert.equal(
    docsFindings(
      docStatements(
        "docs/protocol/test.md",
        "```md\n## Delivery Status\nsharedImpact is accepted.\n```",
      ),
      [],
    ).length,
    1,
  );
  assert.equal(
    docsFindings(
      docStatements(
        "docs/guides/test.md",
        "## Delivery Status\n\nMilestone 30 is complete.",
      ),
      [],
    ).length,
    1,
  );
});

test("exceptions are bounded by exact file and statement and fail when stale", () => {
  const statement = "Removed `ownedDependencies` values are ignored.";
  const exception = {
    file: "src/example/README.md",
    statement,
    reason: "Removed-input migration contract.",
  };
  const statements = docStatements(exception.file, statement);
  assert.deepEqual(docsFindings(statements, [exception]), []);
  assert.equal(
    docsFindings(docStatements("docs/new.md", statement), [exception]).length,
    2,
  );
  assert.equal(
    docsFindings(
      docStatements(exception.file, `${statement}\nsharedImpact is accepted.`),
      [exception],
    ).length,
    1,
  );
  assert.equal(
    docsFindings(
      docStatements(exception.file, statement.replace("ignored", "accepted")),
      [exception],
    ).length,
    2,
  );
  assert.equal(docsFindings([], [exception]).length, 1);
  assert.equal(
    docsFindings(statements, [{ ...exception, reason: "" }]).length,
    2,
  );
});

test("the scan includes all documented Markdown locations and new authored notes", async (t) => {
  for (const file of [
    "docs/protocol/nested/a.md",
    "docs/guides/a.md",
    "docs/architecture/a.md",
    "docs/superpowers/specs/a.md",
    "docs/new/a.md",
    "README.md",
    "src/nested/README.md",
    "packages/viewer/README.md",
    "examples/basic/README.md",
    "xtask/README.md",
    "tests/fixtures/consumer/notes.md",
  ])
    assert.equal(isCurrentDoc(file), true, file);
  for (const file of [
    "plans/old.md",
    "docs/reviews/old.md",
    "CHANGELOG.md",
    "packages/viewer/CHANGELOG.md",
  ])
    assert.equal(isCurrentDoc(file), false, file);
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  execFileSync("git", ["init", "-q"], { cwd: fixture.root });
  const notes = "tests/fixtures/current-docs-new/notes.md";
  await fs.mkdir(path.join(fixture.root, path.dirname(notes)), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.root, notes),
    "Current output requires\nmanifest v5.\n",
  );
  assert.ok(
    docsFindings(await currentDocs(fixture.root), []).some((finding) =>
      finding.startsWith(`${notes}:1:`),
    ),
  );
});

test("the reviewed Unnamed All-filter destination stays documented", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/mokly-design-links.md"),
    "utf8",
  );
  assert.match(
    source,
    /\| Unnamed evidence: All filter\s*\| Canonical All Welcome, `design\/browse\/views\/screen`\s*\|/,
  );
});
