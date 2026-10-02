import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const protocolDirectory = path.join(repositoryRoot, "docs/protocol");
const oversizedCaps: Readonly<Record<string, number>> = {
  "ci-verification.md": 251,
  "mokly-catalogue.md": 322,
  "mokly-changes.md": 419,
  "mokly-comparison-panes.md": 239,
  "mokly-configuration.md": 321,
  "mokly-css-attribution.md": 327,
  "mokly-design-components.md": 254,
  "mokly-design-links.md": 329,
  "mokly-export-delivery.md": 264,
  "mokly-export.md": 279,
  "mokly-frame-adapter.md": 381,
  "mokly-navigation.md": 397,
  "mokly-removed-previews.md": 226,
  "mokly-runtime.md": 443,
  "mokly-shell-design.md": 519,
  "mokly-viewer-appearance.md": 382,
  "mokly-viewer.md": 458,
  "mokly-watch.md": 296,
  "npm-release.md": 264,
};

function sizeIssue(name: string, lines: number, cap: number | undefined) {
  if (cap === undefined)
    return lines > 250
      ? `${name} has ${lines} lines; new protocol docs must stay at or below 250 lines, or gain a reviewed cap`
      : undefined;
  if (lines > cap)
    return `${name} has ${lines} lines, above its ${cap}-line cap; split by responsibility instead of raising the cap`;
  if (lines < cap)
    return `${name} has ${lines} lines; lower the cap to ${lines}`;
  return undefined;
}

test("protocol document size policy rejects growth and stale caps", () => {
  assert.match(sizeIssue("new.md", 251, undefined) ?? "", /250 lines/u);
  assert.match(sizeIssue("old.md", 301, 300) ?? "", /above its 300-line cap/u);
  assert.match(sizeIssue("old.md", 299, 300) ?? "", /lower the cap to 299/u);
  assert.equal(sizeIssue("new.md", 250, undefined), undefined);
  assert.equal(sizeIssue("old.md", 300, 300), undefined);
});

test("nested protocol documents are audited while fixtures are excluded", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-protocol-docs-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.mkdir(path.join(root, "nested"), { recursive: true });
  await fs.mkdir(path.join(root, "fixtures/nested"), { recursive: true });
  await fs.writeFile(
    path.join(root, "nested/too-long.md"),
    "line\n".repeat(251),
  );
  await fs.writeFile(
    path.join(root, "fixtures/nested/ignored.md"),
    "line\n".repeat(251),
  );

  const failures = await documentSizeFailures(root, {});
  assert.deepEqual(failures, [
    "nested/too-long.md has 251 lines; new protocol docs must stay at or below 250 lines, or gain a reviewed cap",
  ]);
});

test("every protocol document obeys its current size cap", async () => {
  const failures = await documentSizeFailures(protocolDirectory, oversizedCaps);
  assert.deepEqual(failures, [], failures.join("\n"));
});

async function documentSizeFailures(
  directory: string,
  caps: Readonly<Record<string, number>>,
) {
  const names = await protocolDocumentNames(directory);
  const failures: string[] = [];
  for (const name of names) {
    const contents = await fs.readFile(path.join(directory, name), "utf8");
    const lines =
      contents.split("\n").length - (contents.endsWith("\n") ? 1 : 0);
    const issue = sizeIssue(name, lines, caps[name]);
    if (issue) failures.push(issue);
  }
  for (const name of Object.keys(caps))
    if (!names.includes(name)) failures.push(`${name} has a stale size cap`);
  return failures;
}

async function protocolDocumentNames(directory: string) {
  const names: string[] = [];
  const visit = async (relative: string) => {
    const entries = await fs.readdir(path.join(directory, relative), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (name !== "fixtures") await visit(name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        names.push(name);
      }
    }
  };
  await visit("");
  return names.sort();
}
