import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../packages/mokly/dist/review/assets.js";
import { CommittedBaselineReader } from "../packages/mokly/dist/review/committed.js";
import { classifyComponents } from "../packages/mokly/dist/review/component_classification.js";
import { CssResourceAnalysis } from "../packages/mokly/dist/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../packages/mokly/dist/review/css/rules.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../packages/mokly/dist/review/git.js";

import { cssAttributionFixture } from "./helpers/css_attribution_fixture.js";

test("component classification reads base CSS in batches and parses shared source once per side", async (t) => {
  const fixture = await cssAttributionFixture(t, true);
  await fixture.append(".guide { padding: 2px; }");
  const batches: string[][] = [];
  class ObservedGit extends CommittedBaselineReader {
    override async readFiles(commit: string, paths: readonly string[]) {
      batches.push([...paths]);
      return super.readFiles(commit, paths);
    }
    override readFileBytes(commit: string, path: string) {
      assert.ok(
        !path.endsWith(".css"),
        "CSS cannot fall back to individual Git reads",
      );
      return super.readFileBytes(commit, path);
    }
  }
  const runner = new NodeGitCommandRunner(fixture.root);
  const git = {
    evidence: new CommittedRepository(runner).evidence,
    reader: new ObservedGit(runner),
  };
  const commit = await git.evidence.mergeBase("main", "HEAD");
  const compilation = await compileCatalogue(fixture.config);
  const calls: string[] = [];
  const native = new LightningCssRuleParser();
  await classifyComponents({
    before: compilation.manifest,
    after: compilation.manifest,
    beforeReader: new GitReviewAssetReader(
      fixture.config,
      git.reader,
      commit,
      "mockups",
    ),
    afterReader: new FileSystemReviewAssetReader(fixture.config),
    changedPaths: ["mockups/shared.css"],
    config: fixture.config,
    baseCommit: commit,
    baseRef: "main",
    cssParser: {
      parse(source) {
        calls.push(source);
        return native.parse(source);
      },
    },
  });
  assert.equal(
    calls.length,
    2,
    "all variants/viewports/schemes share both parsed stylesheets",
  );
  assert.equal(new Set(calls).size, 2);
  assert.equal(
    batches.flat().filter((path) => path === "mockups/shared.css").length,
    1,
  );
  assert.ok(
    batches.some(
      (paths) =>
        paths.includes("mockups/image.svg") &&
        paths.includes("mockups/font.woff2"),
    ),
    "resource depth is one logical batch",
  );
});

test("the run-scoped parser cache contains injected parse failures without retrying per view", () => {
  let calls = 0;
  const analyzer = new CssResourceAnalysis({
    parse() {
      calls++;
      throw new SyntaxError("fixture parse error");
    },
  });
  for (let view = 0; view < 4; view++)
    assert.deepEqual(
      analyzer.analyze(
        [{ path: "shared.css", before: "before", after: "after" }],
        [{}],
      ),
      {
        reasons: [
          {
            kind: "dependency",
            path: "shared.css",
            analysis: { status: "unresolved", selectors: [] },
          },
        ],
      },
    );
  assert.equal(calls, 2);
});
