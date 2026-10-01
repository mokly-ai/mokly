import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { committedReviewRepository } from "../dist/review/repository.js";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

const scenarios = [
  { name: "linked matched", linked: ".entry", expected: ["home"] },
  { name: "linked excluded", linked: ".unused", expected: [] },
  { name: "inline owned", inline: ".actual-only", expected: ["action"] },
  { name: "inline excluded", inline: ".unused", expected: [] },
  { name: "inline entry", inline: ".entry", expected: ["home"] },
  { name: "reference owned", reference: ".actual-only", expected: ["action"] },
  { name: "reference excluded", reference: ".unused", expected: [] },
  { name: "reference entry", reference: ".entry", expected: ["home"] },
];

for (const mode of ["committed", "derived"] as const)
  for (const scenario of scenarios)
    test(`${mode} ${scenario.name} classification is identical at zero and default cache bounds`, async (context) => {
      const { linked, inline, reference } = scenario;
      const style = (color: string) =>
        '<link rel="stylesheet" href="../shared.css"><style>' +
        (inline
          ? `${inline}{color:${color}}`
          : reference
            ? `${reference}{background:url("../image.svg")}`
            : ".unused{padding:1px}") +
        "</style>";
      const fixture = await inlineChangesFixture(
        context,
        style("red"),
        style("blue"),
        {
          colorSchemes: false,
          files: {
            before: {
              "shared.css": `${linked ?? ".unused"}{color:red}`,
              "image.svg": "before-image",
            },
            after: {
              "shared.css": `${linked ?? ".unused"}{color:${linked ? "blue" : "red"}}`,
              "image.svg": reference ? "after-image" : "before-image",
            },
          },
        },
      );
      const config = { ...fixture.config, generatedOutput: mode };
      const git = committedReviewRepository(fixture.config);
      const commit = await git.evidence.mergeBase("main", "HEAD");
      const before = await readBaseManifest(git.reader, commit, fixture.config);
      const after = await compileCatalogue(config);
      const generatedPaths = new Set(
        [...after.outputs.keys()].map((route) => `mockups/${route}`),
      );
      const changedPaths = (await git.evidence.changedPaths(commit)).filter(
        (route) => mode === "committed" || !generatedPaths.has(route),
      );
      const classify = async (cssCacheBytes?: number) => {
        const native = new LightningCssRuleParser();
        let calls = 0;
        const result = await classifyComponents({
          before,
          after: after.manifest,
          beforeReader: new GitReviewAssetReader(
            config,
            git.reader,
            commit,
            "mockups",
          ),
          afterReader:
            mode === "derived"
              ? new CompiledReviewAssetReader(config, after.outputs)
              : new FileSystemReviewAssetReader(config),
          config,
          changedPaths,
          baseCommit: commit,
          baseRef: "main",
          ...(cssCacheBytes === undefined ? {} : { cssCacheBytes }),
          useFastPath: false,
          cssParser: {
            parse(source) {
              calls++;
              return native.parse(source);
            },
          },
        });
        return { result, calls };
      };
      const uncached = await classify(0);
      const bounded = await classify();
      assert.deepEqual(bounded.result, uncached.result);
      assert.ok(
        uncached.calls > bounded.calls,
        "the test must exercise cache hits",
      );
      assert.deepEqual(
        bounded.result.changes.map((entry) => entry.after?.id),
        scenario.expected,
      );
      if (inline) {
        const home = bounded.result.screens.find(
          (screen) => screen.after?.id === "home",
        );
        assert.equal(home?.views.length, 2);
        assert.ok(
          home?.views.every((view) =>
            inline === ".actual-only"
              ? !view.inlineStyles
              : view.inlineStyles?.status ===
                (inline === ".unused" ? "excluded" : "matched"),
          ),
        );
        assert.equal(
          bounded.result.affectedConsumers.some(
            (consumer) => consumer.changedComponentId === "action",
          ),
          inline === ".actual-only",
        );
      }
      if (reference) {
        assert.equal(
          bounded.result.affectedConsumers.length > 0,
          reference === ".actual-only",
        );
        if (reference !== ".unused")
          assert.ok(
            bounded.result.changes.some((entry) =>
              entry.reasons.some(
                (reason) =>
                  reason.kind === "dependency" &&
                  reason.path === "mockups/image.svg",
              ),
            ),
          );
      }
    });
