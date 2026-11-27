import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import { viteFixtureWorker } from "./fixtures/vite/support.js";
import {
  entry,
  pkg,
  probe,
  stylesheet,
  workspace,
} from "./fixtures/vite_workspace.js";

const config = `
  import { value } from "local";
  export default {
    define: { __COLOR__: JSON.stringify(value) },
    plugins: [{ name: "config-color", enforce: "pre", transform(code, id) {
      if (id.endsWith("/workspace.css?inline"))
        return code.replace("__COLOR__", value);
    } }],
  };
`;
const teal = 'export const value: string = "teal";';
const purple = 'export const value: string = "purple";';

for (const mode of ["bundle", "stylesheet"] as const) {
  test(`Vite ${mode} keeps setup source candidates across unchanged requests`, async (context) => {
    const fixture = await workspace(context, probe);
    const params = fixture.params("head");
    await fixture.write("head", "vite.config.mjs", config);
    await fixture.write("head", `${pkg}/src/value.ts`, teal);
    await fixture.write("head", entry, "export const color = __COLOR__;");
    await fixture.write("head", stylesheet, ".site { color: __COLOR__ }");
    const worker = await viteFixtureWorker(context, params.sourceRoot);
    const read = async () => {
      if (mode === "stylesheet") {
        const { text, metadataInputs } =
          await worker.sidecar.call<ViteCssResult>("transformViteCss", {
            setup: { ...params, entryFiles: [] },
            stylesheet,
            file: path.join(params.sourceRoot, stylesheet),
          });
        return { text, metadataInputs };
      }
      const { compiled } = await worker.sidecar.call<BundleResult>(
        "bundle",
        params,
      );
      const text = compiled.vite?.modules
        .map(({ result }) => ("code" in result ? result.code : ""))
        .join("\n");
      assert.ok(text);
      return { text, metadataInputs: compiled.metadataInputs };
    };
    assert.match((await read()).text, /\bteal\b/);
    const unchanged = await read();
    assert.match(unchanged.text, /\bteal\b/);

    const preferred = `${pkg}/src/value.tsx`;
    await fixture.write("head", preferred, purple);
    await assert.rejects(read(), { code: "fresh-worker-required" });
    assert.equal(unchanged.metadataInputs[preferred], null);
    await worker.replaceWorker();
    const fresh = await read();
    assert.match(fresh.text, /\bpurple\b/);
    assert.equal(
      fresh.metadataInputs[preferred],
      createHash("sha256").update(purple).digest("hex"),
    );
    await worker.sidecar.call("shutdown");
  });
}

test("Vite stylesheet-only worker reloads after a workspace rootDir edit", async (context) => {
  const fixture = await workspace(context, probe);
  const setup = { ...fixture.params("head"), entryFiles: [] };
  const layout = `${pkg}/tsconfig.json`;
  await fixture.write("head", "vite.config.mjs", config);
  await fixture.write("head", `${pkg}/src/value.ts`, teal);
  await fixture.write("head", `${pkg}/replacement/value.ts`, purple);
  await fixture.write("head", stylesheet, ".site { color: __COLOR__ }");
  const original = '{"compilerOptions":{"outDir":"dist","rootDir":"src"}}';
  await fixture.write("head", layout, original);
  const worker = await viteFixtureWorker(context, setup.sourceRoot);
  const read = () =>
    worker.sidecar.call<ViteCssResult>("transformViteCss", {
      setup,
      stylesheet,
      file: path.join(setup.sourceRoot, stylesheet),
    });
  const first = await read();
  assert.equal(first.text, ".site { color: teal }");

  await fixture.write(
    "head",
    layout,
    '{"compilerOptions":{"outDir":"dist","rootDir":"replacement"}}',
  );
  await assert.rejects(read(), { code: "fresh-worker-required" });
  assert.equal(
    first.metadataInputs[layout],
    createHash("sha256").update(original).digest("hex"),
  );
  await worker.replaceWorker();
  assert.equal((await read()).text, ".site { color: purple }");
  await worker.sidecar.call("shutdown");
});
