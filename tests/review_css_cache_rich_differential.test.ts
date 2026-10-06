import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { committedReviewRepository } from "../dist/review/repository.js";

import { compareCacheBounds } from "./helpers/css_cache_classification.js";
import {
  designLibraryFixture,
  snapshotReader,
} from "./helpers/design_library_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";

const scenarios = [
  {
    name: "statement at-rules",
    before: '@import "../theme.css";@layer first,second;',
    after: '@import "../theme.css";@layer second,first;',
  },
  {
    name: "block at-rules",
    before: '@font-face{font-family:Before;src:url("../font.woff")}',
    after: '@font-face{font-family:After;src:url("../font.woff")}',
  },
  {
    name: "grouped conditions",
    before:
      "@media screen{@supports (display:grid){@layer theme{.actual-only{color:red;padding:2px}}}}",
    after:
      "@media screen{@supports (display:grid){@layer theme{.actual-only{color:blue;padding:2px}}}}",
  },
  {
    name: "nested excluded rule",
    before: ".missing{.actual-only{color:red;padding:2px}}",
    after: ".missing{.actual-only{color:blue;padding:2px}}",
  },
  {
    name: "custom property",
    before: ".unused{--tone:red;padding:2px}",
    after: ".unused{--tone:blue;padding:2px}",
  },
  {
    name: "reference rule",
    before:
      '@layer theme{.actual-only{background:url("../image.svg");color:red}}',
    after:
      '@layer theme{.actual-only{background:url("../image.svg");color:red}}',
    reference: true,
  },
  {
    name: "inline parse failure",
    before: ".entry{color:red;padding:2px}",
    after: ".entry{notvalid}",
  },
];

for (const mode of ["committed", "derived"] as const) {
  for (const scenario of scenarios)
    test(`${mode} ${scenario.name} preserves classification across cache bounds`, async (context) => {
      const linked = (color: string) =>
        "@layer first,second;@media screen{@supports (display:grid){@layer theme{" +
        `.unused{color:${color};padding:2px}` +
        "}}}";
      const prefix = (css: string) =>
        `<link rel="stylesheet" href="../shared.css"><style>${css}</style>`;
      const resources = {
        "theme.css": ".unused{color:black}",
        "font.woff": "stable-font",
        "image.svg": "before-image",
        "shared.css": linked("red"),
      };
      const fixture = await inlineChangesFixture(
        context,
        prefix(scenario.before),
        prefix(scenario.after),
        {
          colorSchemes: false,
          files: {
            before: resources,
            after: {
              ...resources,
              "shared.css": linked("blue"),
              "image.svg": scenario.reference ? "after-image" : "before-image",
            },
          },
        },
      );
      const config = { ...fixture.config, generatedOutput: mode };
      const git = committedReviewRepository(fixture.config);
      const commit = await git.evidence.mergeBase("main", "HEAD");
      const before = await readBaseManifest(git.reader, commit, config);
      const after = await compileCatalogue(config);
      const generated = new Set(
        [...after.outputs.keys()].map((route) => `mockups/${route}`),
      );
      const result = await compareCacheBounds({
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
        changedPaths: (await git.evidence.changedPaths(commit)).filter(
          (route) => mode === "committed" || !generated.has(route),
        ),
        baseCommit: commit,
        baseRef: "main",
      });
      if (scenario.name === "nested excluded rule")
        assert.deepEqual(result.changes, []);
      else assert.ok(result.changes.length > 0);
      if (scenario.name === "inline parse failure")
        assert.ok(
          result.screens.some((screen) =>
            screen.views.some(
              (view) => view.inlineStyles?.status === "unresolved",
            ),
          ),
        );
    });

  test(`${mode} real design library classification preserves every cache field`, async (context) => {
    const fixture = await designLibraryFixture(context, mode);
    const file =
      "examples/basic/specs/design/library/controls/tag-chip.view.tsx";
    await fixture.edit(file, (source) =>
      source.replace("{label}", "{label} revised"),
    );
    const renderer = "examples/basic/renderer.tsx";
    await fixture.edit(renderer, (source) =>
      source.replaceAll(
        "body{margin:0;background:",
        "body{margin:1px;background:",
      ),
    );
    const after = await fixture.build();
    const result = await compareCacheBounds({
      before: fixture.before.manifest,
      after: after.manifest,
      config: fixture.config,
      changedPaths: [file, renderer],
      beforeReader: snapshotReader(fixture.before, fixture.resources),
      afterReader: snapshotReader(after, fixture.resources),
      baseCommit: "a".repeat(40),
      baseRef: "main",
    });
    assert.ok(
      result.changes.some(
        (entry) => entry.after?.path === "design/library/controls/tag-chip",
      ),
    );
  });
}
