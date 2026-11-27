import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import { viteFixtureWorker } from "./fixtures/vite/support.js";
import { pkg, probe, sides, workspace } from "./fixtures/vite_workspace.js";

for (const side of sides) {
  test(`Vite ${side} keeps relative CSS imports and maps package CSS to source`, async (context) => {
    const fixture = await workspace(context, probe);
    const built = `.built-${side} { color: red }`;
    await fixture.write(side, `${pkg}/dist/theme.css`, built);
    const setup = { ...fixture.params(side), entryFiles: [] };
    const { sidecar } = await viteFixtureWorker(context, setup.sourceRoot);
    for (const [stylesheet, source, expected] of [
      [`${pkg}/bare.css`, "dist/theme.css", built],
      [`${pkg}/dotted.css`, "./dist/theme.css", built],
      [`${pkg}/dist/site.css`, "theme.css", built],
      ["src/site.css", "local/theme.css", `.source-${side} { color: teal }`],
    ] as const) {
      await fixture.write(side, stylesheet, `@import "${source}";`);
      const result = await sidecar.call<ViteCssResult>("transformViteCss", {
        setup,
        stylesheet,
        file: path.join(setup.sourceRoot, stylesheet),
      });
      assert.equal(result.text, expected, source);
    }
    await sidecar.call("shutdown");
  });
}

test("Vite base reports missing relative CSS imports without a sourcePackages hint", async (context) => {
  const fixture = await workspace(context, probe);
  const setup = { ...fixture.params("base"), entryFiles: [] };
  await fixture.write(
    "head",
    `${pkg}/dist/missing.css`,
    ".missing { color: red }",
  );
  for (const [stylesheet, source] of [
    [`${pkg}/dotted.css`, "./dist/missing.css"],
    [`${pkg}/bare.css`, "dist/missing.css"],
  ] as const) {
    await fixture.write("base", stylesheet, `@import "${source}";`);
    const { sidecar } = await viteFixtureWorker(context, setup.sourceRoot);
    await assert.rejects(
      sidecar.call("transformViteCss", {
        setup,
        stylesheet,
        file: path.join(setup.sourceRoot, stylesheet),
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error && "code" in error);
        assert.equal(error.code, "bundle-failed");
        assert.match(error.message, /ENOENT: no such file or directory/);
        assert.ok(error.message.includes(`open '${source}'`), error.message);
        assert.doesNotMatch(error.message, /sourcePackages/);
        return true;
      },
    );
    await sidecar.call("shutdown");
  }
});

for (const [source, expected] of [
  ["theme.css", ".sibling { color: blue }"],
  ["local/theme.css", ".source-head { color: teal }"],
  ["theme/colors.css", ".aliased-once { color: purple }"],
] as const) {
  test(`Vite applies stylesheet aliases once to the authored import ${source}`, async (context) => {
    const fixture = await workspace(context, probe);
    const setup = { ...fixture.params("head"), entryFiles: [] };
    await fixture.write("head", "src/theme.css", ".sibling { color: blue }");
    await fixture.write("head", "src/aliased.css", ".alias { color: green }");
    await fixture.write(
      "head",
      "src/vendor/theme.css",
      ".vendor { color: green }",
    );
    await fixture.write(
      "head",
      "vite.config.mjs",
      `import { resolve } from "node:path";
       export default { resolve: { alias: {
         "./theme.css": resolve(import.meta.dirname, "src/aliased.css"),
         "./local": resolve(import.meta.dirname, "src/vendor"),
         theme: "theme/src",
       } } };`,
    );
    await fixture.write(
      "head",
      "node_modules/theme/package.json",
      '{"name":"theme"}',
    );
    await fixture.write(
      "head",
      "node_modules/theme/src/colors.css",
      ".aliased-once { color: purple }",
    );
    const stylesheet = "src/site.css";
    await fixture.write("head", stylesheet, `@import "${source}";`);
    const { sidecar } = await viteFixtureWorker(context, setup.sourceRoot);
    const result = await sidecar.call<ViteCssResult>("transformViteCss", {
      setup,
      stylesheet,
      file: path.join(setup.sourceRoot, stylesheet),
    });
    await sidecar.call("shutdown");
    assert.equal(result.text, expected);
  });
}
