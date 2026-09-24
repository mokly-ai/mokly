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

test("documented catalogue formats match compilation and both comparison sides", async (t) => {
  const index = await read("docs/protocol/README.md");
  const outputContract = await read("docs/protocol/mokly-generated-output.md");
  assert.match(outputContract, /schemaVersion: 6/);
  assert.match(outputContract, /assetClosure: string\[\]/);
  assert.match(
    outputContract,
    /generatedFiles: \{ path: string; blobHash: string \}\[\]/,
  );
  assert.match(outputContract, /blobHashAlgorithm: "sha1" \| "sha256"/);
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
    const componentComparison = before === components || after === components;
    assert.equal(fixture.after.manifest.schemaVersion, 6);
    assert.equal(result.schemaVersion, componentComparison ? 3 : 2);
    assert.match(
      index,
      after === components
        ? /With registered components\s*\|\s*6\s*\|\s*3/
        : /Without registered components\s*\|\s*6\s*\|\s*2/,
    );
  }
});

test("delivered component contracts do not retain superseded status or version instructions", async () => {
  for (const file of [
    "mokly-components.md",
    "mokly-changes.md",
    "mokly-component-props.md",
    "mokly-component-changes.md",
  ]) {
    const text = await read(`docs/protocol/${file}`);
    assert.doesNotMatch(
      text,
      /not available in the current package|is planned, not implemented|implementation TODOs|does not claim a shipped validator|raw-file logic must be integrated/,
      file,
    );
  }
  assert.doesNotMatch(
    await read("docs/protocol/mokly-export.md"),
    /Keep `ReviewResult\.schemaVersion` at 2/,
  );
  assert.match(await read("README.md"), /manifest v6/);
});
