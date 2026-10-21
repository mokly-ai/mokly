import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

for (const reverse of [false, true]) {
  test(`consumer Emotion cache keeps shared rule owners: reverse=${reverse}`, async (context) => {
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        entryFiles: ["foreign-cache.mockup.tsx"],
        renderer: null,
        storiesFiles: [],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(
      sidecar,
      generation,
      Object.fromEntries(
        [
          "alpha",
          "beta",
          "default",
          "styledAlpha",
          "styledBeta",
          "styledScreen",
        ].map((name) => [
          `foreign-cache.mockup.tsx#${name}`,
          { path: name, title: name },
        ]),
      ),
    );
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation,
      handle: "foreign-cache.mockup.tsx#default",
      entry: { path: "default", title: "Foreign cache" },
      props: { reverse },
      viewport: "desktop",
      colorScheme: "light",
    });
    assert.equal(result.styles.length, 1);
    assert.equal(
      result.styles[0]!.css,
      ".product-twzglc{-webkit-animation:animation-1qa61cu 1s;animation:animation-1qa61cu 1s;}" +
        "@-webkit-keyframes animation-1qa61cu{from{opacity:0;}to{opacity:1;}}" +
        "@keyframes animation-1qa61cu{from{opacity:0;}to{opacity:1;}}",
    );
    assert.equal(result.html.match(/class="product-twzglc"/g)?.length, 2);
    const records = result.styles.flatMap(
      (style) => style.attribution ?? [style],
    );
    for (const keyframes of [false, true]) {
      const owners = records
        .filter((record) => record.css.includes("@keyframes") === keyframes)
        .flatMap((record) => record.owners)
        .sort();
      assert.deepEqual(owners, ["alpha", "beta"]);
    }
    await sidecar.call("shutdown");
  });

  test(`consumer styled sheet keeps shared rule owners: reverse=${reverse}`, async (context) => {
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        entryFiles: ["foreign-cache.mockup.tsx"],
        renderer: null,
        storiesFiles: [],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    await installBindings(
      sidecar,
      generation,
      Object.fromEntries(
        [
          "alpha",
          "beta",
          "default",
          "styledAlpha",
          "styledBeta",
          "styledScreen",
        ].map((name) => [
          `foreign-cache.mockup.tsx#${name}`,
          { path: name, title: name },
        ]),
      ),
    );
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation,
      handle: "foreign-cache.mockup.tsx#styledScreen",
      entry: { path: "styledScreen", title: "Foreign sheet" },
      props: { reverse },
      viewport: "desktop",
      colorScheme: "light",
    });
    assert.equal(result.styles.length, 1);
    const records = result.styles.flatMap(
      (style) => style.attribution ?? [style],
    );
    assert.deepEqual(records.flatMap((record) => record.owners).sort(), [
      "styledAlpha",
      "styledBeta",
    ]);
    await sidecar.call("shutdown");
  });
}
