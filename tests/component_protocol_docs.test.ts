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

test("manifest v9 and review v6 share path identity", async (t) => {
  const catalogue = await read("docs/protocol/mokly-catalogue.md");
  const outputContract = await read(
    "docs/protocol/mokly-generated-manifest.md",
  );
  assert.match(outputContract, /schemaVersion: 9/);
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
    assert.equal(fixture.after.manifest.schemaVersion, 9);
    assert.equal(result.schemaVersion, 6);
    assert.match(
      catalogue,
      after === components
        ? /With registered components\s*\|\s*9\s*\|\s*6/
        : /Without registered components\s*\|\s*9\s*\|\s*6/,
    );
  }
});
