import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { repositoryRoot, validEntrySource } from "./helpers/fixture.js";

const read = (file: string) =>
  fs.readFile(path.join(repositoryRoot, file), "utf8");

test("manifest v7 ships before the identity-keyed comparison format", async (t) => {
  const index = await read("docs/protocol/README.md");
  const plain = validEntrySource();
  const components = componentEntrySource();
  for (const [before, after] of [
    [plain, plain],
    [components, components],
    [plain, components],
    [components, plain],
  ]) {
    const fixture = await componentReviewFixture(t, () => after!, before!);
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(fixture.after.manifest.schemaVersion, 7);
    assert.equal(result.schemaVersion, 4);
    assert.match(
      index,
      after === components
        ? /With registered components\s*\|\s*7\s*\|\s*4/
        : /Without registered components\s*\|\s*7\s*\|\s*4/,
    );
  }
});

test("delivered component contracts do not retain superseded status or version instructions", async () => {
  const families = [
    "mokly-components",
    "mokly-changes",
    "mokly-component-props",
    "mokly-component-changes",
  ];
  const files = (
    await fs.readdir(path.join(repositoryRoot, "docs/protocol"))
  ).filter(
    (file) =>
      file.endsWith(".md") &&
      families.some((family) => file.startsWith(family)),
  );
  assert.ok(files.length > families.length);
  for (const file of files) {
    const text = await read(`docs/protocol/${file}`);
    assert.doesNotMatch(
      text,
      /not available in the current package|is planned, not implemented|implementation TODOs|does not claim a shipped validator|raw-file logic must be integrated/,
      file,
    );
  }
  for (const file of (
    await fs.readdir(path.join(repositoryRoot, "docs/protocol"))
  ).filter((file) => file.startsWith("mokly-export") && file.endsWith(".md")))
    assert.doesNotMatch(
      await read(`docs/protocol/${file}`),
      /Keep `ReviewResult\.schemaVersion` at 2/,
      file,
    );
  assert.match(await read("README.md"), /Current output uses manifest v7/);
});
