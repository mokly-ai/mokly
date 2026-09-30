import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const buildWarnings = fs.readFileSync(
  path.join(repositoryRoot, "docs/protocol/mokly-build-warnings.md"),
  "utf8",
);
const terminalOutput = fs.readFileSync(
  path.join(repositoryRoot, "docs/protocol/mokly-terminal-output.md"),
  "utf8",
);

test("the build-warning contract owns exact terminal formats", () => {
  assert.ok(buildWarnings.includes("[mokly/warning] <route>: <message>\\n"));
  assert.ok(buildWarnings.includes("  ! <route>: <message>\\n"));
  assert.doesNotMatch(buildWarnings, /Terminal line formats are owned by/u);
  assert.match(
    terminalOutput,
    /build warnings contract[^.]*owns warning order, exact stderr formats/u,
  );
});

test("warning routes use the generated artifact-path contract", () => {
  assert.match(buildWarnings, /mokly-artifact-paths\.md/u);
  assert.doesNotMatch(buildWarnings, /manifest routes/u);
});
