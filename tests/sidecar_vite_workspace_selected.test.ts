import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { viteFixtureWorker } from "./fixtures/vite/support.js";
import {
  entry,
  pkg,
  probe,
  sides,
  workspace,
} from "./fixtures/vite_workspace.js";
import { moduleNames } from "./helpers/native_resolution.js";

for (const side of sides) {
  test(`Vite ${side} compiles source for missing build files selected by an ordered hook`, async (context) => {
    const fixture = await workspace(context, probe);
    if (side === "head") {
      await fs.unlink(path.join(fixture.roots.head, pkg, probe.build));
      await fs.unlink(path.join(fixture.roots.head, pkg, "dist/theme.css"));
    }
    await fixture.write(side, "vite.config.mjs", selectedBuild(probe.build));
    await fixture.write(
      side,
      entry,
      'export { value } from "local"; import "local/theme.css";',
    );
    const params = fixture.params(side);
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const result = await sidecar.call<BundleResult>("bundle", params);
    await sidecar.call("shutdown");
    assert.deepEqual(moduleNames(result).sort(), [
      `${pkg}/src/theme.css`,
      `${pkg}/src/value.ts`,
      entry,
    ]);
  });
}

test("Vite suggests a sourcePackages mapping for a missing build selected by a hook", async (context) => {
  const layout = { ...probe, build: "esm/value.js", source: "source/value.ts" };
  const fixture = await workspace(context, layout);
  await fixture.write("base", "vite.config.mjs", selectedBuild(layout.build));
  await fixture.write("base", entry, 'export { value } from "local";');
  const params = fixture.params("base");
  const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
  await assert.rejects(sidecar.call("bundle", params), {
    code: "bundle-failed",
    message:
      /module packages\/local\/esm\/value\.js has no source in this side; set moduleResolution\.sourcePackages for local/,
  });
  await sidecar.call("shutdown");
});

test("Vite keeps a missing build selected by a hook when sourcePackages is false", async (context) => {
  const fixture = await workspace(context, {
    ...probe,
    sourcePackages: [{ local: false }],
  });
  await fixture.write("base", "vite.config.mjs", selectedBuild(probe.build));
  await fixture.write("base", entry, 'export { value } from "local";');
  const params = fixture.params("base");
  const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
  await assert.rejects(sidecar.call("bundle", params), {
    code: "bundle-failed",
    message:
      /module packages\/local\/dist\/value\.js has no source in this side \(Vite /,
  });
  await sidecar.call("shutdown");
});

function selectedBuild(build: string): string {
  return `
    import { resolve } from "node:path";
    const builds = ${JSON.stringify({
      local: `${pkg}/${build}`,
      "local/theme.css": `${pkg}/dist/theme.css`,
    })};
    export default { plugins: [{ name: "own-root-build", resolveId: {
      order: "pre",
      handler(source) {
        if (Object.hasOwn(builds, source))
          return resolve(import.meta.dirname, builds[source]);
      },
    } }] };
  `;
}
