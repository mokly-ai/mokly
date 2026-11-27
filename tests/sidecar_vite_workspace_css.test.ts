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
