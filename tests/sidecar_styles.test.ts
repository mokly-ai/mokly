import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

test("sidecar extracts consumer runtime registries on repeated renders", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["runtime-styles.mockup.tsx"],
      renderer: null,
      storiesFiles: [],
      moduleResolution: {
        aliases: {},
        conditions: [],
        loaders: {},
        mainFields: ["module", "main"],
        packageRoots: [],
        resolveExtensions: [],
      },
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  for (let count = 0; count < 2; count++) {
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation: bundled.generation,
      handle: "runtime-styles.mockup.tsx#default",
      props: {},
      viewport: "desktop",
      colorScheme: "light",
    });
    assert.match(result.html, /Styled/);
    assert.match(result.html, /Emotion/);
    assert.match(result.styles.join("\n"), /rgb\(1,\s*2,\s*3\)/);
    assert.match(result.styles.join("\n"), /rgba\(4,\s*5,\s*6,\s*1\.00\)/);
    assert.match(result.styles.join("\n"), /rgb\(7,\s*8,\s*9\)/);
  }
  await sidecar.call("shutdown");
});
