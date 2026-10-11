import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  normalizeBuildDiagnostics,
  type BuildDiagnostic,
} from "../dist/build/build_warnings.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { compileRuntime } from "../dist/build/compile_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { linkWarningFailureFixture } from "./helpers/link_control_warning_fixture.js";

for (const outcome of [
  "resource",
  "success",
  "placement",
  "placement-success",
] as const) {
  test(`compilation forwards each link warning before ${outcome}`, async (t) => {
    const fixture = await linkWarningFailureFixture(outcome);
    t.after(() => fixture.remove());
    const streamed: BuildDiagnostic[] = [];
    const pending = compileCatalogue(
      await loadConfig(fixture.root),
      undefined,
      undefined,
      (warning) => streamed.push(warning),
    );
    if (outcome.endsWith("success"))
      assert.deepEqual((await pending).diagnostics, fixture.diagnostics);
    else await assert.rejects(pending, fixture.failure);
    assert.equal(streamed.length, fixture.diagnostics.length);
    assert.deepEqual(normalizeBuildDiagnostics(streamed), fixture.diagnostics);
  });

  if (outcome.startsWith("placement"))
    test(`Serve compilation forwards placement warnings on ${outcome}`, async (t) => {
      const fixture = await linkWarningFailureFixture(outcome);
      t.after(() => fixture.remove());
      const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
      const warnings: BuildDiagnostic[] = [];
      const rendering = compileRuntime(
        runtime,
        async () => {},
        (warning) => warnings.push(warning),
      );
      if (outcome.endsWith("success"))
        assert.deepEqual((await rendering).diagnostics, fixture.diagnostics);
      else await assert.rejects(rendering, fixture.failure);
      assert.equal(warnings.length, fixture.diagnostics.length);
      assert.deepEqual(
        normalizeBuildDiagnostics(warnings),
        fixture.diagnostics,
      );
    });

  test(
    `background build reports link warnings once before ${outcome}`,
    { timeout: 30_000 },
    async (t) => {
      const fixture = await linkWarningFailureFixture(outcome);
      t.after(() => fixture.remove());
      const events: string[] = [];
      const diagnostics: BuildDiagnostic[] = [];
      let finish!: () => void;
      const settled = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const reporter = new PlainServeReporter((line) => events.push(line));
      const reportWarnings = reporter.buildWarnings.bind(reporter);
      reporter.buildWarnings = (warnings) => {
        diagnostics.push(...warnings);
        reportWarnings(warnings);
      };
      reporter.catalogueReady = () => {
        events.push("ready");
        finish();
      };
      const reportFailure = reporter.runtimeDiagnostic.bind(reporter);
      reporter.runtimeDiagnostic = (error) => {
        reportFailure(error);
        finish();
      };
      const running = await serve(
        await loadConfig(fixture.root),
        { port: 0, watch: false },
        { reporter },
      );
      fixture.beforeRemove(() => running.close());
      await settled;
      assert.deepEqual(diagnostics, fixture.diagnostics);
      assert.equal(events.length, fixture.diagnostics.length + 1);
      assert.ok(
        events.slice(0, -1).every((line) => line.startsWith("[mokly/warning]")),
      );
      if (outcome.endsWith("success")) assert.equal(events.at(-1), "ready");
      else assert.match(events.at(-1)!, fixture.failure);
    },
  );
}

test(
  "a failing watched compilation reports earlier render warnings before its failure",
  { timeout: 30_000 },
  async (context) => {
    const source = `${declared()}
import { definePage } from "@mokly/mokly";
mockups.push(definePage({ path: "broken", title: "Broken", description: "Broken", relatedDocs: [], render: () => { throw new Error("broken page after warned render"); } }));`;
    const fixture = await fixtureWithSheets(
      source,
      'renderer: "renderer.tsx", stylesheets: [],',
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.root, "renderer.tsx"),
      `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => { const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>'; return input.entry.path === "home" ? { html, resources: [{ path: "action.css", componentIds: ["action"] }] } : { html }; };`,
    );
    const events: string[] = [];
    const running = await serve(
      await loadConfig(fixture.root),
      { port: 0, watch: true },
      { reporter: new PlainServeReporter((value) => events.push(value)) },
    );
    fixture.beforeRemove(() => running.close());
    for (let attempt = 0; attempt < 800; attempt += 1) {
      if (
        events.some((line) => line.includes("broken page after warned render"))
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const warningIndex = events.findIndex((line) =>
      line.includes("ignored. Changes follow the elements"),
    );
    const failureIndex = events.findIndex((line) =>
      line.includes("broken page after warned render"),
    );
    assert.ok(warningIndex >= 0, events.join(""));
    assert.ok(failureIndex > warningIndex, events.join(""));
  },
);
