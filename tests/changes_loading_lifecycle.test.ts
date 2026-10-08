import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import type { ComponentChangeSnapshot } from "../dist/server/component_change_types.js";
import { BackgroundCompilation } from "../dist/server/demand/background.js";
import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { waitUntil } from "./helpers/wait_until.js";

for (const watch of [false, true]) {
  for (const outcome of ["ready", "unavailable", "failed"] as const) {
    test(
      `Serve publishes ${outcome} Changes after loading (watch=${watch})`,
      { timeout: 15000 },
      async (t) => {
        const fixture = await changedFixture(t);
        const compilation = await compileCatalogue(fixture.config);
        let finish: (
          value: ComponentChangeSnapshot | undefined,
        ) => void = () => {};
        const result = new Promise<ComponentChangeSnapshot | undefined>(
          (resolve) => {
            finish = resolve;
          },
        );
        t.mock.method(BackgroundCompilation.prototype, "classify", async () => {
          const value = await result;
          if (outcome === "failed") throw new Error("Classification failed");
          return value;
        });
        const running = await serve(fixture.config, {
          port: 0,
          watch,
          base: "main",
        });
        try {
          const pending = await (await fetch(running.url)).text();
          assert.match(pending, /data-changes-status="pending"/);
          assert.match(pending, /data-filter="changed"/);
          finish(
            outcome === "ready"
              ? { baseline: compilation.manifest, changedEntries: [] }
              : undefined,
          );
          const status = outcome === "ready" ? "ready" : "unavailable";
          let completed = "";
          await waitUntil(
            async () => {
              completed = await (await fetch(running.url)).text();
              return completed.includes(`data-changes-status="${status}"`);
            },
            {
              timeoutMs: 15_000,
              intervalMs: 10,
              message: `Serve did not publish ${status} Changes`,
            },
          );
          assert.match(
            completed,
            new RegExp(`data-changes-status="${status}"`),
          );
          assert.doesNotMatch(completed, /mbk-nav-spinner/);
          if (outcome === "ready")
            assert.match(completed, /mbk-nav-filter-count">0</);
        } finally {
          finish(undefined);
          await running.close();
        }
      },
    );
  }
}
