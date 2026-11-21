import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { folderPackage } from "./helpers/package_folder.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

test("marked internal targets retain folder checks across ordinary matches and condition order", async (context) => {
  for (const ordinary of [
    "./node_modules/chosen/lib/value/index.js",
    "chosen/exact/value",
  ])
    for (const reversed of [false, true]) {
      const conditions = reversed
        ? { node: "chosen/sub/value", browser: ordinary }
        : { browser: ordinary, node: "chosen/sub/value" };
      const fixture = await folderPackage(context, {
        name: `${ordinary} ${reversed}`,
        manifest: JSON.stringify({
          name: "catalogue",
          imports: { "#value": conditions },
        }),
        request: "#value",
        original: "node_modules/chosen/lib/value/index.js",
        preferred: "node_modules/chosen/lib/value.ts",
      });
      await write(
        path.join(fixture.root, "node_modules/chosen/package.json"),
        '{"name":"chosen","exports":{"./sub/":"./lib/","./exact/value":"./lib/value/index.js"}}',
      );
      const first = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        "serveEdit",
      );
      assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
      assert.match(first.result.compiled.code, /original-index/);
      await fixture.unrelated();
      assert.equal(
        (await reuse([first.generation], fixture.params, "serveEdit"))
          ?.runtimeKey,
        first.result.compiled.runtimeKey,
      );
      await fixture.addPreferred();
      const native = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        "serveEdit",
      );
      assert.match(native.result.compiled.code, /preferred-file/);
      assert.equal(
        (await reuse([first.generation], fixture.params, "serveEdit"))
          ?.runtimeKey,
        undefined,
      );
    }
});

test("marked folder ownership ignores nested exports in installed and aliased PnP packages", async (context) => {
  for (const route of ["installed", "pnp"] as const) {
    const fixture =
      route === "pnp"
        ? await pnpFolder(context, "binding", true, true)
        : await folderPackage(context, { name: route, route: "installed" });
    const pkg = path.join(
      fixture.root,
      route === "pnp" ? ".yarn/chosen" : "node_modules/chosen",
    );
    await write(
      path.join(pkg, "lib/value/package.json"),
      '{"exports":{"./sub/value":"./index.js"}}',
    );
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.match(first.result.compiled.code, /original-index/);
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
    await fixture.addPreferred();
    const native = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.match(native.result.compiled.code, /preferred-file/);
    assert.equal(
      (await reuse([first.generation], fixture.params, "serveEdit"))
        ?.runtimeKey,
      undefined,
      route,
    );
  }
  for (const capture of ["full", "serveEdit"] as const) {
    const fixture = await pnpFolder(context, "json", false);
    await write(
      path.join(fixture.root, "tsconfig.json"),
      '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
    );
    await write(
      path.join(fixture.root, "src/x.ts"),
      'export const value="mapped-source";',
    );
    await write(
      path.join(fixture.root, "entry.mjs"),
      'export {value} from "@/x";',
    );
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      capture,
    );
    assert.match(first.result.compiled.code, /mapped-source/);
    assert.equal(
      first.result.compiled.reuseEvidence.complete,
      capture === "full",
    );
    assert.equal(
      first.result.compiled.reuseEvidence.uncaptured,
      capture === "serveEdit" ? "serveEdit" : undefined,
    );
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
  }
});
