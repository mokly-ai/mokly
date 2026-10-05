import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import {
  assertFastPathEquivalent,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import {
  ignoredLinksRenderer,
  linkSource,
  prepareLinkFixture,
} from "./helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const mode of ["raw", "component"] as const)
  for (const resource of [
    "action.css",
    "nested.css",
    "base.css",
    "ignored-selector",
  ] as const)
    test(`${mode} ignored links preserve only inserted resource evidence (${resource})`, async (t) => {
      const fixture = await createFixture(linkSource, {
        extraConfig:
          'renderer: "renderer.tsx", colorSchemes: ["light", "dark"], stylesheets: [{match:"**",stylesheets:["base.css"]}],',
      });
      t.after(() => removeFixture(fixture));
      const renderer =
        mode === "raw"
          ? ignoredLinksRenderer
          : `import React from "react";
import { ReviewIgnore } from "@mokly/mokly";
import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<html><head>' + renderToStaticMarkup(<ReviewIgnore id="assets">{input.stylesheets.map((href) => <link key={href} rel="stylesheet" href={href} />)}<style>{'.author{color:red}'}</style></ReviewIgnore>) + '</head><body>' + renderToStaticMarkup(<><ReviewIgnore id="author"><p className="ignored">Ignored author</p></ReviewIgnore>{input.node}</>) + '</body></html>';`;
      await prepareLinkFixture(fixture, renderer);
      const files = {
        "action.css":
          resource === "nested.css"
            ? '@import "./nested.css";'
            : resource === "ignored-selector"
              ? ".ignored{color:red}"
              : ".action{color:red}",
        "nested.css": ".action{color:red}",
        "base.css": ".heading{color:red}",
      };
      for (const [file, css] of Object.entries(files))
        await fs.writeFile(path.join(fixture.mockupsDir, file), css);
      const config = await loadConfig(fixture.root);
      const before = await compileCatalogue(config);
      const changed = resource === "ignored-selector" ? "action.css" : resource;
      const current = {
        ...files,
        [changed]: files[changed].replace("red", "blue"),
      };
      await fs.writeFile(
        path.join(fixture.mockupsDir, changed),
        current[changed],
      );
      const after = await compileCatalogue(config);
      const result = await assertFastPathEquivalent({
        before: before.manifest,
        after: after.manifest,
        beforeFiles: compilationFiles(before, files),
        afterFiles: compilationFiles(after, current),
        config,
        changedPaths: [`mockups/${changed}`],
      });
      const insertedChange =
        resource === "action.css" || resource === "nested.css";
      assert.deepEqual(
        result.changes.map((entry) => (entry.after ?? entry.before)!.id).sort(),
        insertedChange ? ["action", "action-default"] : [],
      );
      assert.deepEqual(
        [
          ...new Set(
            result.affectedConsumers.map((entry) => entry.changedComponentId),
          ),
        ],
        insertedChange ? ["action"] : [],
      );
      const screen = result.screens.find((entry) => entry.id === "checkout")!;
      assert.ok(
        screen.views.every(
          (view) => view.state === (insertedChange ? "changed" : "unchanged"),
        ),
      );
      for (const view of screen.views) {
        assert.equal(view.material, undefined);
        assert.deepEqual(
          view.reasons?.map((reason) => reason.path) ?? [],
          insertedChange ? [`mockups/${changed}`] : [],
        );
        if (insertedChange) {
          assert.deepEqual(
            view.reasons![0]!.analysis!.rules[0]!.changedComponentIds,
            ["action"],
          );
          assert.equal(view.reasons![0]!.analysis!.pageEvidence, undefined);
        }
        if (resource === "ignored-selector")
          assert.deepEqual(view.excludedResources, [
            { path: "mockups/action.css", reason: "no-matching-rule" },
          ]);
        if (resource === "base.css")
          assert.equal(view.excludedResources, undefined);
      }
    });

test("ignored author markup and inline styles stay ignored beside inserted links", async (t) => {
  const fixture = await createFixture(linkSource, {
    extraConfig:
      'renderer:"renderer.tsx",stylesheets:[{match:"**",stylesheets:["base.css"]}],',
  });
  t.after(() => removeFixture(fixture));
  await prepareLinkFixture(fixture, ignoredLinksRenderer);
  const config = await loadConfig(fixture.root);
  const before = await compileCatalogue(config);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    ignoredLinksRenderer
      .replace("Ignored author", "Changed author")
      .replace("color:red", "color:blue"),
  );
  const after = await compileCatalogue(config);
  const css = {
    "action.css": ".action{color:red}",
    "base.css": ".heading{color:red}",
  };
  const result = await assertFastPathEquivalent({
    before: before.manifest,
    after: after.manifest,
    beforeFiles: compilationFiles(before, css),
    afterFiles: compilationFiles(after, css),
    config,
    changedPaths: [
      "renderer.tsx",
      ...[...after.outputs.keys()].map((route) => `mockups/${route}`),
    ],
  });
  assert.deepEqual(result.changes, []);
  for (const view of result.screens.find((screen) => screen.id === "checkout")!
    .views) {
    assert.equal(view.state, "ignored-only");
    assert.equal(view.material, undefined);
    assert.equal(view.reasons, undefined);
    assert.deepEqual(view.ignoredIds, ["assets", "author"]);
  }
});
