import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  version,
  waitForInitialChanges,
  waitForUpdate,
} from "./helpers/watched_catalogue.js";
import { waitFor } from "./server_fixture.js";

for (const build of [false, true]) {
  test(
    `watched Serve refreshes its authored closure after CSS additions and removals (build=${build})`,
    { timeout: 60_000 },
    async (t) => {
      const fixture = await createFixture(undefined, {
        extraConfig:
          'stylesheets: [{ match: "**", stylesheets: ["theme.css"] }], watch: { debounceMs: 0 },',
      });
      t.after(() => removeFixture(fixture));
      const stylesheet = path.join(fixture.mockupsDir, "theme.css");
      await fs.writeFile(stylesheet, 'main{background:url("a.svg")}');
      await fs.writeFile(path.join(fixture.mockupsDir, "a.svg"), "<svg/>");
      await fs.writeFile(
        path.join(fixture.mockupsDir, "b.svg"),
        '<svg width="42"/>',
      );
      const outputStore = new FileSystemGeneratedOutputStore();
      const completed = new Set<string>();
      const write = outputStore.write.bind(outputStore);
      t.mock.method(
        outputStore,
        "write",
        async (...args: Parameters<typeof write>) => {
          await write(...args);
          completed.add(JSON.stringify(args[0].manifest.assetClosure));
        },
      );
      const running = await serve(
        await loadConfig(fixture.root),
        { watch: true, build, port: 0 },
        { outputStore },
      );
      fixture.beforeRemove(() => running.close());
      await waitForInitialChanges(running.url);
      const manifest = path.join(fixture.generatedDir, "mokly-manifest.json");
      const checkClosure = async (expected: string[]) => {
        if (build) {
          await waitFor(async () => completed.has(JSON.stringify(expected)));
          assert.deepEqual(
            JSON.parse(await fs.readFile(manifest, "utf8")).assetClosure,
            expected,
          );
        } else
          await assert.rejects(fs.stat(fixture.generatedDir), {
            code: "ENOENT",
          });
      };
      await checkClosure(["a.svg", "theme.css"]);
      for (const target of ["b.svg", undefined]) {
        const before = version(await (await fetch(running.url)).text());
        await fs.writeFile(
          stylesheet,
          target ? `main{background:url("${target}")}` : "main{color:green}",
        );
        await waitForUpdate(running.url, before);
        await waitFor(
          async () =>
            (await fetch(running.url + "/static/b.svg")).status ===
            (target ? 200 : 404),
        );
        await checkClosure(target ? [target, "theme.css"] : ["theme.css"]);
      }
    },
  );
}
