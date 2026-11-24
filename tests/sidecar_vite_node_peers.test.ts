import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { nativePeerFixture } from "./fixtures/vite_node_peers.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("native Vite dependencies share the side's React peers in live and restored generations", async (context) => {
  await reportDuration(
    "Vite native React peers",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const modules = await nativePeerFixture(fixture.root, fixture.parent);
      const params = {
        ...fixture.params,
        entryFiles: ["src/native.mockup.tsx"],
        renderer: null,
        moduleResolution: {
          ...fixture.params.moduleResolution,
          packageRoots: [
            modules,
            ...fixture.params.moduleResolution.packageRoots,
          ],
        },
      };
      const live = startSidecar(context, fixture.root);
      await live.call("hello");
      const bundle = await live.call<BundleResult>("bundle", params);
      const restored = startSidecar(context, fixture.root);
      await restored.call("hello");
      for (const sidecar of [live, restored]) {
        await assert.doesNotReject(async () => {
          await sidecar.call("restoreGeneration", { ...bundle, params });
          await sidecar.call("cssModules", {
            generation: bundle.generation,
            classMaps: {},
          });
          await installBindings(sidecar, bundle.generation);
          const result = await sidecar.call<RenderResult>("renderScreen", {
            generation: bundle.generation,
            handle: "src/native.mockup.tsx#screen",
            entry: { path: "native", title: "Native" },
            props: {},
            viewport: "mobile",
            colorScheme: "light",
          });
          assert.equal(
            result.html,
            "<p>esm=true;cjs=true;lazy=true;scope=true</p>",
          );
        });
        await sidecar.call("shutdown");
        await fs.rm(path.join(fixture.root, "src"), {
          recursive: true,
          force: true,
        });
      }
    },
  );
});
