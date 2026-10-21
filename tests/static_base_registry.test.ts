import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { managers } from "./helpers/base_manager_tools.js";
import { baseRegistryFixture } from "./helpers/base_registry_fixture.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

for (const manager of managers) {
  test(
    `a cold ${manager.name} base installs from its configured registry with user credentials`,
    { timeout: 120_000 },
    async (context) => {
      const fixture = await baseRegistryFixture(manager, context);
      const result = await command(
        fixture.root,
        "build",
        [
          "--base=HEAD",
          "--out=.context/site",
          "--sidecars=1",
          "--debug-timings",
        ],
        "plain",
        fixture.env,
        context.signal,
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const span = timings(result.stderr).find(
        (record) =>
          record.stage === "review.base-dependencies" && record.event === "end",
      );
      if (span?.tier !== 2)
        context.diagnostic(await fs.readFile(fixture.managerOutput, "utf8"));
      assert.equal(span?.tier, 2, result.stderr);
      assert.doesNotMatch(result.stderr, /base dependencies/u);
      assert.equal(await fs.readFile(fixture.network, "utf8"), "");
      const tarball =
        "/mokly-cold-dependency/-/mokly-cold-dependency-1.0.0.tgz";
      assert.ok(
        fixture.registry.requests.some(
          (request) => request.path === tarball && request.authorized,
        ),
        JSON.stringify(fixture.registry.requests),
      );
      assert.ok(
        fixture.registry.requests.every((request) => request.authorized),
        JSON.stringify(fixture.registry.requests),
      );
      const namespace = result.stdout
        .split("\n")
        .find((line) => line.startsWith("Mokly cache: "))
        ?.slice("Mokly cache: ".length);
      assert.ok(namespace, result.stdout);
      const entries = path.join(namespace, "dependencies/entries");
      const [key] = await fs.readdir(entries);
      const installed = path.join(entries, key!, "data");
      assert.match(
        await fs.readFile(
          path.join(installed, "node_modules/mokly-cold-dependency/index.js"),
          "utf8",
        ),
        /Base dependency/u,
      );
      for (const relative of [
        "lifecycle-ran",
        "node_modules/mokly-cold-dependency/lifecycle-ran",
      ]) {
        await assert.rejects(fs.stat(path.join(installed, relative)), {
          code: "ENOENT",
        });
      }
      const calls = await fs.readFile(fixture.calls, "utf8");
      assert.equal(calls.trim().split("\n").length, 1, calls);
    },
  );
}
