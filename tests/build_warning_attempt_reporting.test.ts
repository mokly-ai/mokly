import assert from "node:assert/strict";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { BuildWarningSink } from "../dist/build/warning_sink.js";
import {
  PlainServeReporter,
  reportCatalogueReady,
} from "../dist/server/reporter.js";

const compilation: Compilation = {
  diagnostics: [
    {
      code: "removed-dependencies",
      subject: { kind: "entry", path: "home" },
      message: "dependencies has been removed; ignoring it. Delete the field.",
    },
    {
      code: "link-control-ancestor",
      route: "home/index.html",
      message:
        "MockLink child control is inside <button>; one click or key press has two targets",
    },
  ],
  manifest: {
    schemaVersion: 9,
    generatedBy: "mokly",
    folders: [],
    entries: [],
    sourceFiles: [],
    assetClosure: [],
    generatedFiles: [],
    blobHashAlgorithm: "sha1",
  },
  outputs: new Map(),
  deliveredStyleSources: [],
};

function fixture() {
  const events: string[] = [];
  class Reporter extends PlainServeReporter {
    override catalogueReady() {
      events.push("ready");
    }
  }
  const reporter = new Reporter((value) => events.push(value));
  const sink = new BuildWarningSink((warning) =>
    reporter.buildWarnings([warning]),
  );
  return { events, reporter, sink };
}

test("completion combines both producers once before Catalogue ready", () => {
  const { events, reporter, sink } = fixture();
  sink.add(compilation.diagnostics[0]!);
  assert.deepEqual(events, []);
  reportCatalogueReady(reporter, compilation, 0, sink, sink.generation);
  assert.deepEqual(events, [
    '[mokly/warning] entry "home": dependencies has been removed; ignoring it. Delete the field.\n',
    "[mokly/warning] home/index.html: MockLink child control is inside <button>; one click or key press has two targets\n",
    "ready",
  ]);
  sink.add(compilation.diagnostics[0]!);
  assert.equal(events.length, 3);
});

test("a completion from retired inputs cannot publish warnings during a newer attempt", () => {
  const { events, reporter, sink } = fixture();
  const old = sink.generation;
  sink.add(compilation.diagnostics[0]!);
  sink.reset();
  reportCatalogueReady(reporter, compilation, 0, sink, old);
  assert.deepEqual(events, []);
  reportCatalogueReady(
    reporter,
    { ...compilation, diagnostics: [] },
    0,
    sink,
    sink.generation,
  );
  assert.deepEqual(events, ["ready"]);
});
