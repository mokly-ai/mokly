import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { stripMarkers } from "../src/components/comparison_material.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { compareInlineOracle } from "./helpers/inline_analysis_oracle.js";
import { inlineInput } from "./helpers/inline_styles.js";

test("real cumulative RNW view pairs preserve the M4 ordered diff, material and attributions", async (context) => {
  const root = await fs.mkdtemp(path.resolve(".context/m5-rnw-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await generateLargeFixture(root, {
    areas: 2,
    screens: 2,
    rows: 1,
    inlineStyles: true,
  });
  const compilation = await compileCatalogue(await loadConfig(root));
  const sources = [...compilation.outputs.values()].map((source) =>
    stripMarkers(source),
  );
  const parser = new CssResourceAnalysis().parser;
  let compared = 0;
  for (let index = 1; index < sources.length; index += 4) {
    compareInlineOracle(
      inlineInput({
        before: sources[index - 1]!,
        after: sources[index]!,
        parser,
      }),
      `real RNW pair ${index}`,
    );
    compared++;
  }
  assert.ok(compared >= 15);
});
