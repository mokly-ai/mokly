import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("Vite shared metadata retains plugin-loaded files beside the per-module input digests", async (context) => {
  await reportDuration(
    "Vite plugin-loaded metadata",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      await fs.writeFile(
        path.join(fixture.root, "vite.config.ts"),
        `
      import fs from "node:fs";
      import path from "node:path";
      export default { plugins: [{ name: "load-side-input",
        async transform(code, id) {
          if (!id.endsWith("/metadata.mockup.ts")) return;
          await this.load({ id: path.join(import.meta.dirname, "src/side-input.ts") });
          return code.replace("__LOADED__", JSON.stringify(fs.readFileSync(path.join(import.meta.dirname, "src/side-input.ts"), "utf8")));
        },
      }] };
    `,
      );
      const sideInput = 'export const value = "loaded";';
      await fs.writeFile(
        path.join(fixture.root, "src/side-input.ts"),
        sideInput,
      );
      await fs.writeFile(
        path.join(fixture.root, "src/metadata.mockup.ts"),
        `
      import { definePage } from "@mokly/mokly";
      export const page = definePage({title: "Metadata", description: "", relatedDocs: [],
        render: () => "<html><head></head><body>" + __LOADED__ + "</body></html>",
      });
    `,
      );
      const sidecar = startSidecar(context, fixture.root);
      await sidecar.call("hello");
      const bundle = await sidecar.call<BundleResult>("bundle", {
        ...fixture.params,
        renderer: null,
        entryFiles: ["src/metadata.mockup.ts"],
      });
      const digest = createHash("sha256").update(sideInput).digest("hex");
      assert.equal(bundle.compiled.metadataInputs["src/side-input.ts"], digest);
      assert.equal(
        bundle.compiled.metadataInputs["src/metadata.mockup.ts"],
        undefined,
      );
      assert.equal(
        bundle.modules.some((module) => module.path === "src/side-input.ts"),
        false,
      );
      assert.equal(
        bundle.compiled.inputs[path.join(fixture.root, "src/side-input.ts")],
        digest,
      );
      assert.equal(
        typeof bundle.compiled.inputs[
          path.join(fixture.root, "src/metadata.mockup.ts")
        ],
        "string",
      );
      await installBindings(sidecar, bundle.generation);
      const page = await sidecar.call<PageResult>("renderPage", {
        generation: bundle.generation,
        handle: "src/metadata.mockup.ts#page",
      });
      assert.equal(
        page.html,
        '<html><head></head><body>export const value = "loaded";</body></html>',
      );
      const next = await sidecar.call<BundleResult>("bundle", {
        ...fixture.params,
        renderer: null,
        entryFiles: ["src/metadata.mockup.ts"],
      });
      assert.equal(next.compiled.metadataInputs["src/side-input.ts"], digest);
      const updatedSource = 'export const value = "updated";';
      await fs.writeFile(
        path.join(fixture.root, "src/side-input.ts"),
        updatedSource,
      );
      const updated = await sidecar.call<BundleResult>("bundle", {
        ...fixture.params,
        renderer: null,
        entryFiles: ["src/metadata.mockup.ts"],
      });
      assert.equal(
        updated.compiled.metadataInputs["src/side-input.ts"],
        createHash("sha256").update(updatedSource).digest("hex"),
      );
      await installBindings(sidecar, updated.generation);
      const updatedPage = await sidecar.call<PageResult>("renderPage", {
        generation: updated.generation,
        handle: "src/metadata.mockup.ts#page",
      });
      assert.equal(
        updatedPage.html,
        '<html><head></head><body>export const value = "updated";</body></html>',
      );
      await sidecar.call("shutdown");
    },
  );
});
