import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestV10 } from "@mokly/viewer/data";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import type { Compilation } from "../dist/build/compile.js";
import {
  PlainServeReporter,
  reportCatalogueReady,
} from "../dist/server/reporter.js";

import { currentManifest } from "./helpers/current_manifest.js";

test("Serve reports one generation's warnings immediately before catalogue ready", () => {
  const reporter = new WarningReporter();
  const compilation: Compilation = {
    diagnostics: [
      {
        code: "link-control-ancestor",
        route: "screens/home.desktop.html",
        message: "MockLink child control is inside <button>",
      },
    ],
    manifest: currentManifest({
      entries: [],
      folders: [],
      generatedBy: "mokly",
      schemaVersion: 10,
      sourceFiles: [],
    }),
    deliveredStyleSources: [],
    outputs: new Map(),
  };

  reportCatalogueReady(reporter, compilation, 12);

  assert.deepEqual(reporter.events, [
    "warning:screens/home.desktop.html",
    "catalogue:screen=0",
  ]);
});

test("plain standalone Serve uses the stable warning stderr format", () => {
  const output: string[] = [];
  const reporter = new PlainServeReporter((value) => output.push(value));
  reporter.buildWarnings([
    {
      code: "link-control-descendant",
      route: "screens/home.mobile.html",
      message: 'MockLink child control contains <span tabindex="0">',
    },
  ]);
  assert.deepEqual(output, [
    '[mokly/warning] screens/home.mobile.html: MockLink child control contains <span tabindex="0">\n',
  ]);
});

test("plain standalone Serve escapes warning control characters", () => {
  const output: string[] = [];
  const reporter = new PlainServeReporter((value) => output.push(value));
  reporter.buildWarnings([
    {
      code: "link-control-ancestor",
      route: "screens/home\u001b[2J.html",
      message: "warning\u009b2J",
    },
  ]);
  assert.deepEqual(output, [
    "[mokly/warning] screens/home\\u001b[2J.html: warning\\u009b2J\n",
  ]);
  assert.ok(!output[0]!.includes("\u001b"));
  assert.ok(!output[0]!.includes("\u009b"));
});

class WarningReporter extends PlainServeReporter {
  readonly events: string[] = [];

  override buildWarnings(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of diagnostics)
      this.events.push(`warning:${diagnostic.route}`);
  }

  override catalogueReady(manifest: ManifestV10): void {
    const screens = manifest.entries.filter(
      (entry) => entry.kind === "screen",
    ).length;
    this.events.push(`catalogue:screen=${screens}`);
  }
}
