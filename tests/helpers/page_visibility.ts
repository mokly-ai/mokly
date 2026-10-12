import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type { ResolvedConfig } from "../../dist/config/types.js";

import { compilationFiles } from "./component_fast_path.js";
import { comparePageViews } from "./page_comparison.js";

export async function assertParserRecoveryDifference(
  compilation: Compilation,
  config: ResolvedConfig,
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
  changedPaths: readonly string[],
) {
  const input = {
    before: compilation.manifest,
    after: compilation.manifest,
    beforeFiles: compilationFiles(compilation, before),
    afterFiles: compilationFiles(compilation, after),
    config,
    changedPaths,
  };
  const old = (await comparePageViews(input, true)).filter(
    ({ entryId }) => entryId === "home",
  );
  const current = (await comparePageViews(input)).filter(
    ({ entryId }) => entryId === "home",
  );
  assert.ok(old.length > 0);
  assert.equal(current.length, old.length);
  for (const { comparison, path } of old)
    assert.ok(
      comparison.reasons.some(
        ({ kind }) => kind === "dependency" || kind === "material",
      ),
      `${path}: M6 reparsing exposed a resource`,
    );
  for (const { comparison, path } of current) {
    assert.deepEqual(
      comparison.reasons,
      [],
      `${path}: M7 source records cannot invent parser-discarded or newly exposed siblings`,
    );
    assert.equal(comparison.view.state, "unchanged", path);
  }
}
