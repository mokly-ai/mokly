import assert from "node:assert/strict";
import test from "node:test";

import { createAuthoring } from "../packages/mokly/src/authoring/definitions.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { describe } from "../packages/mokly/src/sidecar/describe.js";

import { bundleParams } from "./helpers/sidecar.js";

test("duplicate export lists escape authored controls before joining location lines", async () => {
  const first = "specs/\nfirst\t\u001b\u0085Ω.mockup.ts";
  const second = "specs/[second\n.mockup.ts";
  const title = "First\n  Second\t\u001b\u0085Ω\\u000a";
  const generation = restore(
    bundleParams({
      entryFiles: [second, first],
      renderer: null,
      storiesFiles: [],
    }),
    {
      identity: "list-diagnostic",
      toolchain: "fixture",
      reuseEvidence: { complete: true, durable: false, inputs: {} },
      code: "module.exports={}",
      runtimeKey: "list-diagnostic-runtime",
      dependencyRoots: [],
      cssModules: [],
      sources: {
        [second]: "export const page = null;",
        [first]: "export const page = null;",
      },
      peers: {},
      inputs: {},
      metadataInputs: {},
      inputDirectories: {},
      metadataDirectories: {},
    },
    [],
  );
  const { definePage } = createAuthoring(generation.runtime, "specs/shared.ts");
  const page = definePage({
    title,
    description: "",
    relatedDocs: [],
    render: () => "Page",
  });
  generation.exports = {
    entries: { [second]: { page }, [first]: { page } },
    stories: {},
  };

  const definitions = await describe(generation);

  assert.deepEqual(definitions.diagnostics, [
    {
      code: "duplicate-export",
      module: second,
      exportName: "page",
      message:
        "definition First\\u000a  Second\\u0009\\u001b\\u0085Ω\\u000a is exported by two entry modules:\n" +
        "  specs/\\u000afirst\\u0009\\u001b\\u0085Ω.mockup.ts export page\n" +
        "  specs/[second\\u000a.mockup.ts export page",
    },
  ]);
  assert.deepEqual(
    definitions.pages.map((definition) => definition.title),
    [title],
  );
});
