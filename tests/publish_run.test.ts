import assert from "node:assert/strict";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { ResolvedConfig } from "../dist/config/types.js";
import {
  publishCatalogue,
  type PublishDependencies,
} from "../dist/publish/run.js";

const head = "a".repeat(40);
const base = "b".repeat(40);
const comparisonPath = `__mokly/diffs/__generations/${"c".repeat(64)}/review.json`;
const config = { configPath: "/repo/tools/mokly.config.ts" } as ResolvedConfig;
const options = {
  endpoint: "https://example.com/upload",
  token: "secret",
  repository: "github.com/team/catalogue",
};

function dependencies() {
  let uploaded = false;
  let metadata: Record<string, unknown> | undefined;
  const boundaries: PublishDependencies = {
    git: {
      run: async (args) =>
        args[0] === "symbolic-ref"
          ? "feature"
          : args.includes("--show-toplevel")
            ? "/repo"
            : head,
    },
    now: () => new Date("2026-09-14T12:34:56.789Z"),
    export: async (_config, selected) => {
      const files = new Map<string, string | Uint8Array>([
        ["index.html", "<h1>Consumer catalogue</h1>"],
        [
          comparisonPath,
          JSON.stringify({
            schemaVersion: 4,
            baseRef: "origin/main",
            baseCommit: base,
            changedPaths: [],
            ignoredImpact: [],
            screens: [],
          }),
        ],
      ]);
      const routes = {
        outDir: "/repo/site",
        comparisonUrl: `/${comparisonPath}`,
        idRoutes: {},
      };
      await selected.adapter?.transform(files, routes);
      metadata = JSON.parse(String(files.get("mokly-upload.json")));
      await selected.capture?.(files);
      return { ...routes, deploymentId: "d".repeat(64) };
    },
    fetch: async (_url, init) => {
      uploaded = true;
      assert.match(
        gunzipSync(init!.body as Buffer).toString(),
        /Consumer catalogue/,
      );
      return new Response(null, { status: 204 });
    },
  };
  return { boundaries, uploaded: () => uploaded, metadata: () => metadata };
}

test("publish obtains the merge base and comparison path from the pinned review artifact", async () => {
  const fixture = dependencies();
  await publishCatalogue(config, options, "1.2.3", {}, fixture.boundaries);
  assert.equal(fixture.uploaded(), true);
  assert.deepEqual(fixture.metadata(), {
    schemaVersion: 1,
    moklyVersion: "1.2.3",
    repository: { host: "github.com", owner: "team", name: "catalogue" },
    branch: "feature",
    headSha: head,
    baseRef: "origin/main",
    baseSha: base,
    pullRequest: null,
    configPath: "tools/mokly.config.ts",
    exportedAt: "2026-09-14T12:34:56.789Z",
    comparisonPath,
  });
});

test("a moved HEAD or failed export prevents the HTTP side effect", async () => {
  const moved = dependencies();
  const git = moved.boundaries.git;
  let reads = 0;
  moved.boundaries.git = {
    run: async (args) => {
      if (args.includes("--verify") && ++reads > 1) return "e".repeat(40);
      return git.run(args);
    },
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, moved.boundaries),
    /git-failed.*HEAD changed/,
  );
  assert.equal(moved.uploaded(), false);
  const failed = dependencies();
  failed.boundaries.export = async () => {
    throw new Error("export failed");
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, failed.boundaries),
    /export failed/,
  );
  assert.equal(failed.uploaded(), false);
});

test("invalid metadata prevents bundle capture and upload", async () => {
  const fixture = dependencies();
  await assert.rejects(
    publishCatalogue(
      { ...config, configPath: "/outside/secret" },
      options,
      "1.2.3",
      {},
      fixture.boundaries,
    ),
    /upload-invalid-bundle/,
  );
  assert.equal(fixture.uploaded(), false);
});
