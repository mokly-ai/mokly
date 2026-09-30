import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue, type Compilation } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  MANIFEST_NAME,
} from "../dist/registry/manifest.js";
import { compareReview } from "../dist/review/compare.js";
import { computeChangedIds } from "../dist/server/changed.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const originalCss = ".action{color:red}";
const source = componentEntrySource({
  body: '<ReviewIgnore id="clock" materialKey={"a".repeat(64)}>Before</ReviewIgnore><action.Component label="Only action" /><p>Caller content</p>',
  actionRender:
    '(props) => <button className="action">{props.label}<ReviewIgnore id="internal">Old</ReviewIgnore></button>',
});

for (const edit of [
  "none",
  "owned-css",
  "global-css",
  "caller",
  "ignored",
  "material-key",
  "implementation",
])
  test(`historical v7 retired arrays preserve inline attribution: ${edit}`, async (t) => {
    const fixture = await createFixture(source, {
      extraConfig: 'renderer: "renderer.tsx", colorSchemes: ["light", "dark"],',
    });
    t.after(() => removeFixture(fixture));
    const rendererPath = path.join(fixture.root, "renderer.tsx");
    await fs.writeFile(rendererPath, renderer(originalCss));
    const config = await loadConfig(fixture.root);
    const before = historical(await compileCatalogue(config));
    if (edit === "owned-css")
      await fs.writeFile(rendererPath, renderer(".action{color:green}"));
    if (edit === "global-css")
      await fs.writeFile(rendererPath, renderer(originalCss, "inline"));
    await fs.writeFile(
      fixture.entryPath,
      edit === "caller"
        ? source.replaceAll("Caller content", "Caller edit")
        : edit === "ignored"
          ? source
              .replaceAll(">Before<", ">After<")
              .replaceAll(">Old<", ">New<")
          : edit === "material-key"
            ? source.replaceAll('"a".repeat(64)', '"b".repeat(64)')
            : edit === "implementation"
              ? source.replace(
                  '<button className="action">',
                  '<button className="action changed">',
                )
              : source,
    );
    const after = await compileCatalogue(config);
    await writeCompilation(after, config);
    const changedPaths = [...after.outputs.keys()].map(
      (route) => `mockups/${route}`,
    );
    const git = componentGit(before, changedPaths);
    const artifact = await compareReview(after, config, git, "main");
    assert.equal(artifact.result.schemaVersion, 4);
    if (artifact.result.schemaVersion !== 4) return;
    const expected =
      edit === "owned-css" || edit === "implementation"
        ? ["action"]
        : edit === "global-css"
          ? ["action", "pane", "home"]
          : edit === "caller" || edit === "material-key"
            ? ["home"]
            : [];
    assert.deepEqual(
      artifact.result.changes.map((entry) => entry.after!.id),
      expected,
    );
    assert.deepEqual(
      await computeChangedIds(config, "main", git),
      [...expected].sort(),
    );
    const screenReview = artifact.result.screens.find(
      (screen) => screen.id === "home",
    )!;
    assert.equal(
      screenReview.state,
      edit === "none"
        ? "unchanged"
        : edit === "ignored"
          ? "ignored-only"
          : "changed",
    );
    if (edit === "ignored")
      for (const view of screenReview.views)
        assert.deepEqual(view.ignoredIds, ["clock", "internal"]);
    if (edit === "owned-css" || edit === "implementation")
      assert.ok(
        artifact.result.affectedConsumers.some(
          (item) => item.consumer.kind === "screen",
        ),
      );
    for (const view of generatedViews(
      after.manifest.entries.find((entry) => entry.id === "home")!,
    )) {
      assert.equal(
        artifact.files.get(`snapshots/before/${view.path}`),
        before.outputs.get(view.path),
      );
      assert.equal(
        artifact.files.get(`snapshots/after/${view.path}`),
        after.outputs.get(view.path),
      );
    }
  });

function renderer(css: string, display = "block"): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => {
  const css = ${JSON.stringify(css)};
  return '<html><head></head><body><p>😀</p>' + renderToStaticMarkup(input.node) + '<style>body{display:${display}}' + css + '</style><p>Trailing caller text</p></body></html>';
};`;
}

/** Keep obsolete ownership data in the baseline blob, not in the accepted records. */
function historical(compilation: Compilation): Compilation {
  const manifest = structuredClone(compilation.manifest);
  const outputs = new Map(
    [...compilation.outputs].map(([route, html]) => [
      route,
      html.replace(
        `<style>body{display:block}${originalCss}</style>`,
        `<style>${originalCss}body{display:block}</style>`,
      ),
    ]),
  );
  for (const entry of manifest.entries)
    for (const view of generatedViews(entry)) {
      const html = outputs.get(view.path)!;
      const startOffset = html.indexOf(originalCss);
      assert.ok(startOffset > html.indexOf("<!--mokly-component:"));
      assert.equal(
        html.slice(startOffset, startOffset + originalCss.length),
        originalCss,
      );
      Object.assign(view.usage!, {
        styles: [
          {
            startOffset,
            endOffset: startOffset + originalCss.length,
            componentIds: ["action"],
          },
        ],
        resources: [{ malformed: true }],
      });
    }
  outputs.set(MANIFEST_NAME, JSON.stringify(manifest));
  return {
    ...compilation,
    manifest: parseHistoricalManifest(manifest),
    outputs,
  };
}
