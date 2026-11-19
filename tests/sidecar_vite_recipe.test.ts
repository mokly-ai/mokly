import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("a fresh sidecar replays old Vite code after source removal without loading the changed setup", async (context) => {
  await reportDuration(
    "Vite recipe restore",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const params = {
        ...fixture.params,
        entryFiles: ["src/page.mockup.ts"],
        renderer: null,
      };
      const original = startSidecar(context, fixture.root);
      await original.call("hello");
      const result = await original.call<BundleResult>("bundle", params);
      await original.call("shutdown");
      await fs.writeFile(
        path.join(fixture.root, "src/message.js"),
        "export default 'new source';",
      );
      await fs.rm(path.join(fixture.root, "src"), { recursive: true });
      await fs.writeFile(
        path.join(fixture.root, "vite.config.ts"),
        "throw new Error('the current setup must not load');",
      );
      const restored = startSidecar(context, fixture.root);
      await restored.call("hello");
      await assert.doesNotReject(async () => {
        await restored.call("restoreGeneration", { ...result, params });
        await restored.call("cssModules", {
          generation: result.generation,
          classMaps: {},
        });
        await installBindings(restored, result.generation);
        const page = await restored.call<PageResult>("renderPage", {
          generation: result.generation,
          handle: "src/page.mockup.ts#page",
        });
        assert.equal(
          page.html,
          "<!doctype html><html><head><title>Vite page</title></head><body>alias from Vite|raw from Vite|env from Vite|dynamic from Vite|once</body></html>",
        );
        assert.deepEqual(restored.operations, []);
      });
      await restored.call("shutdown");
    },
  );
});
