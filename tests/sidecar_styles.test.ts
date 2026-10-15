import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

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
        packageRoots: bundleParams().moduleResolution.packageRoots,
        resolveExtensions: [],
      },
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  await installBindings(sidecar, bundled.generation);
  for (let count = 0; count < 2; count++) {
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation: bundled.generation,
      handle: "runtime-styles.mockup.tsx#default",
      entry: { path: "styles", title: "Styles" },
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

test("persistent registry rules exclude unused styles and do not depend on render order", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["registry.mockup.tsx"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  const render = (useSecond: boolean) =>
    sidecar.call<RenderResult>("renderScreen", {
      generation,
      handle: "registry.mockup.tsx#default",
      entry: { path: "registry", title: "Registry" },
      props: { useSecond },
      viewport: "mobile",
      colorScheme: "light",
    });
  const first = await render(false);
  const second = await render(true);
  assert.match(first.styles.join(""), /rgba\(11,22,33,1.00\)/);
  assert.ok(!first.styles.join("").includes("44,55,66"));
  assert.match(second.styles.join(""), /rgba\(44,55,66,1.00\)/);
  assert.ok(!second.styles.join("").includes("11,22,33"));
  assert.deepEqual(await render(false), first);
});
