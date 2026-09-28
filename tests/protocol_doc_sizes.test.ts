import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const protocolDirectory = path.join(repositoryRoot, "docs/protocol");
const oversizedCaps: Readonly<Record<string, number>> = {
  "ci-verification.md": 341,
  "mokly-catalogue.md": 325,
  "mokly-changes.md": 435,
  "mokly-comparison-panes.md": 258,
  "mokly-configuration.md": 333,
  "mokly-css-attribution.md": 327,
  "mokly-design-components.md": 254,
  "mokly-design-links.md": 329,
  "mokly-export-delivery.md": 338,
  "mokly-export.md": 303,
  "mokly-frame-adapter.md": 381,
  "mokly-navigation.md": 410,
  "mokly-removed-previews.md": 290,
  "mokly-runtime.md": 443,
  "mokly-shell-design.md": 579,
  "mokly-viewer-appearance.md": 382,
  "mokly-viewer.md": 498,
  "mokly-watch.md": 296,
  "npm-release.md": 414,
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

test("every protocol document obeys its current size cap", async () => {
  const names = (await fs.readdir(protocolDirectory)).filter((name) =>
    name.endsWith(".md"),
  );
  const failures: string[] = [];
  for (const name of names) {
    const contents = await fs.readFile(
      path.join(protocolDirectory, name),
      "utf8",
    );
    const lines =
      contents.split("\n").length - (contents.endsWith("\n") ? 1 : 0);
    const issue = sizeIssue(name, lines, oversizedCaps[name]);
    if (issue) failures.push(issue);
  }
  for (const name of Object.keys(oversizedCaps))
    if (!names.includes(name)) failures.push(`${name} has a stale size cap`);
  assert.deepEqual(failures, [], failures.join("\n"));
});
