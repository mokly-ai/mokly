import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { lookupFixture } from "./fixtures/vite_lookup.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

for (const side of ["head", "base"] as const) {
  test(`Vite ${side} resolves setup and module packages from package roots with Vite conditions`, async (context) => {
    await reportDuration(
      `Vite ${side} package roots`,
      (line) => context.diagnostic(line),
      async () => {
        const fixture = await lookupFixture(context, side);
        await assert.doesNotReject(async () => {
          const bundle = await fixture.sidecar.call<BundleResult>(
            "bundle",
            fixture.params,
          );
          assert.equal(
            (await fixture.render(bundle)).html,
            "<html><head></head><body>root-esm condition|root-cjs condition|root-esm|root-cjs</body></html>",
          );
        });
        await fixture.sidecar.call("shutdown");
      },
    );
  });
}

test("a Vite alias to an installed CommonJS file loads the package in Node", async (context) => {
  await reportDuration(
    "Vite CommonJS alias",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const target = path.resolve("node_modules/@babel/parser/lib/index.js");
      await fs.writeFile(
        path.join(fixture.root, "vite.config.ts"),
        `export default { resolve: { alias: { "fixture-parser": ${JSON.stringify(target)} } } };`,
      );
      await fs.writeFile(
        path.join(fixture.root, "src/alias.mockup.ts"),
        `
      import { parse } from "fixture-parser";
      import { definePage } from "@mokly/mokly";
      export const page = definePage({title: "Alias", description: "", relatedDocs: [],
        render: () => "<html><head></head><body>" + parse("aliased").program.body[0].expression.name + "</body></html>",
      });
    `,
      );
      const sidecar = startSidecar(context, fixture.root);
      await sidecar.call("hello");
      await assert.doesNotReject(async () => {
        const bundle = await sidecar.call<BundleResult>("bundle", {
          ...fixture.params,
          renderer: null,
          entryFiles: ["src/alias.mockup.ts"],
        });
        await installBindings(sidecar, bundle.generation);
        const page = await sidecar.call<PageResult>("renderPage", {
          generation: bundle.generation,
          handle: "src/alias.mockup.ts#page",
        });
        assert.equal(
          page.html,
          "<html><head></head><body>aliased</body></html>",
        );
      });
      await sidecar.call("shutdown");
    },
  );
});
