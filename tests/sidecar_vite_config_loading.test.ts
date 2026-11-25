import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { viteFiles } from "./fixtures/vite/support.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";

const configs = [
  {
    name: "CommonJS exports and require",
    file: "vite.config.cjs",
    source:
      'const helper = require("./config/helper.cjs"); const { suffix } = require("mokly-config-conditions"); module.exports = { define: { __CONFIG__: JSON.stringify(helper.label + suffix) } };',
    helper: 'module.exports = { label: "before" };',
    requirePackage: true,
  },
  {
    name: "CommonJS TypeScript",
    file: "vite.config.cts",
    source:
      'const label: string = require("./config/helper.cjs").label; module.exports = { define: { __CONFIG__: JSON.stringify(label) } };',
    helper: 'module.exports = { label: "before" };',
  },
  {
    name: "original file values and require binding",
    file: "vite.config.ts",
    source: `#!/usr/bin/env node
      import { label } from "./config/helper.ts";
      if (__dirname !== import.meta.dirname || __filename !== import.meta.filename || import.meta.url !== new URL("vite.config.ts", "file://" + __dirname + "/").href) throw new Error("wrong config context");
      export default { define: { __CONFIG__: JSON.stringify(label) } };`,
    helperFile: "config/helper.ts",
    helper: `import path from "node:path";
      if (path.dirname(__filename) !== __dirname || __dirname !== import.meta.dirname || __filename !== import.meta.filename) throw new Error("wrong helper context");
      const input = "./label.json";
      require.resolve(input);
      export const label = "before";`,
  },
  {
    name: "ES module with a local CommonJS helper",
    file: "vite.config.mjs",
    source:
      'import helper from "./config/helper.cjs"; export default { define: { __CONFIG__: JSON.stringify(helper.label) } };',
    helper: 'module.exports = { label: "before" };',
  },
  {
    name: "async factory with a deferred local import",
    file: "vite.config.ts",
    source:
      'export default async () => { await Promise.resolve(); const { label } = await import("./config/helper.ts"); return { define: { __CONFIG__: JSON.stringify(label) } }; };',
    helperFile: "config/helper.ts",
    helper: 'export const label = "before";',
  },
  {
    name: "async factory with an installed package import",
    file: "vite.config.ts",
    source:
      'export default async () => { await Promise.resolve(); const { parse } = await import("@babel/parser"); const { default: helper } = await import("./config/helper.cjs"); return { define: { __CONFIG__: JSON.stringify(parse(helper.label).program.body[0].expression.name) } }; };',
    helper: 'module.exports = { label: "before" };',
  },
] as const;

for (const side of ["head", "base"] as const) {
  for (const config of configs) {
    test(`Vite ${side} loads ${config.name} in memory`, async (context) => {
      const fixture = await reviewFixture(context, side);
      if ("requirePackage" in config) {
        const packages = path.join(fixture.parent, "config-packages");
        const installed = path.join(
          packages,
          "node_modules/mokly-config-conditions",
        );
        await fs.mkdir(installed, { recursive: true });
        await fs.writeFile(
          path.join(installed, "package.json"),
          JSON.stringify({
            name: "mokly-config-conditions",
            type: "module",
            exports: { import: "./import.mjs", require: "./require.cjs" },
          }),
        );
        await fs.writeFile(
          path.join(installed, "import.mjs"),
          'export const suffix = "wrong import condition";',
        );
        await fs.writeFile(
          path.join(installed, "require.cjs"),
          'exports.suffix = "";',
        );
        fixture.params.moduleResolution.packageRoots.push(packages);
      }
      await fixture.write(config.file, config.source);
      const helper =
        "helperFile" in config ? config.helperFile : "config/helper.cjs";
      await fixture.write(helper, config.helper);
      await fixture.write("config/label.json", '{"label":"before"}');
      await fixture.write("src/review.mockup.ts", reviewPage("__CONFIG__"));
      const before = await viteFiles(fixture.root);
      await assert.doesNotReject(async () => {
        const first = await fixture.compile();
        assert.equal(
          (await fixture.render(first)).html,
          "<html><head></head><body>before</body></html>",
        );
        assert.equal(typeof first.compiled.metadataInputs[helper], "string");
        await fixture.write(helper, config.helper.replace("before", "after"));
        await assert.rejects(fixture.compile(), {
          code: "fresh-worker-required",
        });
        await fixture.replaceWorker();
        const second = await fixture.compile();
        assert.equal(
          (await fixture.render(second)).html,
          "<html><head></head><body>after</body></html>",
        );
      });
      assert.deepEqual(await viteFiles(fixture.root), before);
      await fixture.sidecar.call("shutdown");
    });
  }
}

for (const location of ["vite.config.ts", "config/failing.ts"]) {
  test(`Vite setup errors name ${location} instead of the entry`, async (context) => {
    const fixture = await reviewFixture(context);
    await fixture.write("src/review.mockup.ts", reviewPage('"entry"'));
    await fixture.write(
      "vite.config.ts",
      location === "vite.config.ts"
        ? 'throw new Error("setup failed"); export default {};'
        : 'import "./config/failing.ts"; export default {};',
    );
    if (location !== "vite.config.ts")
      await fixture.write(location, 'throw new Error("setup failed");');
    await assert.rejects(fixture.compile(), (error: Error) => {
      assert.match(
        error.message,
        new RegExp(`^${location.replaceAll(".", "\\.")}:`),
      );
      assert.doesNotMatch(error.message, /review\.mockup\.ts/);
      assert.doesNotMatch(error.message, new RegExp(fixture.root));
      return true;
    });
    await fixture.sidecar.call("shutdown");
  });
}

test("Vite base config import failures name the config with logical paths", async (context) => {
  const fixture = await reviewFixture(context, "base");
  const [head] = fixture.params.repositoryRoots;
  assert.ok(head);
  const modules = path.join(head, "node_modules");
  const workspace = path.join(head, "packages/local");
  const manifest = '{"name":"workspace-local","exports":"./dist/value.js"}';
  await fs.unlink(modules);
  await fs.mkdir(modules);
  await fs.mkdir(path.join(workspace, "dist"), { recursive: true });
  await fs.writeFile(path.join(workspace, "package.json"), manifest);
  await fs.writeFile(
    path.join(workspace, "dist/value.js"),
    "export default 1;",
  );
  await fs.symlink(
    workspace,
    path.join(modules, "workspace-local"),
    "junction",
  );
  await fixture.write("packages/local/package.json", manifest);
  await fixture.write("src/review.mockup.ts", reviewPage('"entry"'));
  await fixture.write(
    "vite.config.mjs",
    'import "workspace-local"; export default {};',
  );

  await assert.rejects(
    fixture.compile(),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "bundle-failed");
      assert.match(error.message, /^vite\.config\.mjs:/);
      assert.match(
        error.message,
        /module packages\/local\/dist\/value\.js has no source in this side/,
      );
      assert.doesNotMatch(
        error.message,
        /(?:^|[\s'"`])(?:file:\/\/|[A-Za-z]:[\\/]|\/)/,
      );
      assert.doesNotMatch(
        error.message,
        /\.\.[\\/]|esbuild[\\/]lib[\\/]main\.js/,
      );
      assert.doesNotMatch(error.message, /\0|\/@id\/|\b(?:virtual|mokly):/);
      return true;
    },
  );
  await fixture.sidecar.call("shutdown");
});
