import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";

import { reviewFixture } from "./fixtures/vite_review.js";
import { moduleNames } from "./helpers/native_resolution.js";

const entry = "src/review.mockup.ts";

test("Vite preserves the active resolveId kind", async (context) => {
  await assertSelected(
    context,
    "export const value = 0;",
    `(() => {
      let resolveId;
      return {
        name: "resolve-by-kind",
        configureServer(server) {
          const container = server.environments.ssr.pluginContainer;
          resolveId = container.resolveId.bind(container);
        },
        async transform(_code, id) {
          if (id.endsWith("/review.mockup.ts")) {
            const result = await resolveId("fixture:inner", id, { kind: "import-rule" });
            return "export { value } from " + JSON.stringify(result.id);
          }
        },
      };
    })(),
    { name: "select", resolveId: {
      order: "pre",
      handler(source, _importer, options) {
        if (source !== "fixture:inner") return;
        return resolve(import.meta.dirname, options.kind === "import-rule" ? "src/selected.ts" : "src/default.ts");
      },
    } }`,
  );
});

for (const order of ["ordered", "ordinary"] as const) {
  const pre = order === "ordered" ? 'order: "pre",' : "";

  test(`Vite passes transform resolution options to an ${order} setup hook`, async (context) => {
    await assertSelected(
      context,
      "export const value = 0;",
      `{ name: "transform", enforce: "pre", async transform(_code, id) {
        if (id.endsWith("/review.mockup.ts")) {
          const result = await this.resolve("fixture:inner", id, {
            custom: { fixture: { select: true } },
            attributes: { fixture: "selected" },
            isEntry: true,
          });
          return "export { value } from " + JSON.stringify(result.id);
        }
      } },
      { name: "select", enforce: "pre", resolveId: {
        ${pre}
        handler(source, _importer, options) {
          if (source !== "fixture:inner") return;
          const selected = options.custom?.fixture?.select &&
            options.attributes.fixture === "selected" && options.isEntry;
          return resolve(import.meta.dirname, selected ? "src/selected.ts" : "src/default.ts");
        },
      } }`,
    );
  });

  test(`Vite honors default skipSelf with an ${order} setup hook`, async (context) => {
    await assertSelected(
      context,
      "export const value = 0;",
      `{ name: "transform", enforce: "pre", async transform(_code, id) {
        if (id.endsWith("/review.mockup.ts")) {
          const result = await this.resolve("fixture:inner", id);
          return "export { value } from " + JSON.stringify(result.id);
        }
      }, resolveId: {
        ${pre}
        handler(source) {
          if (source === "fixture:inner")
            return resolve(import.meta.dirname, "src/default.ts");
        },
      } },
      { name: "select", enforce: "pre", resolveId: {
        ${pre}
        handler(source) {
          if (source === "fixture:inner")
            return resolve(import.meta.dirname, "src/selected.ts");
        },
      } }`,
    );
  });

  test(`Vite resolves a nested alias from an ${order} setup hook`, async (context) => {
    await assertSelected(
      context,
      'export { value } from "fixture:outer";',
      `{ name: "outer", enforce: "pre", resolveId: {
        ${pre}
        async handler(source, importer) {
          if (source !== "fixture:outer") return;
          const result = await this.resolve("@selected/selected.ts", importer);
          return result ?? resolve(import.meta.dirname, "src/default.ts");
        },
      } }`,
    );
  });
}

async function assertSelected(
  context: TestContext,
  contents: string,
  plugins: string,
): Promise<void> {
  const fixture = await reviewFixture(context);
  await fixture.write(entry, contents);
  await fixture.write("src/default.ts", 'export const value = "default";');
  await fixture.write("src/selected.ts", 'export const value = "selected";');
  await fixture.write(
    "vite.config.mjs",
    `import { resolve } from "node:path";
     export default {
       resolve: { alias: { "@selected": resolve(import.meta.dirname, "src") } },
       plugins: [${plugins}],
     };`,
  );
  const result = await fixture.compile();
  await fixture.sidecar.call("shutdown");
  assert.deepEqual(moduleNames(result).sort(), [entry, "src/selected.ts"]);
}
