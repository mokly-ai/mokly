import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedConfig } from "../dist/config/types.js";
import {
  publishCatalogue,
  type PublishDependencies,
  type PublishUploadProgress,
} from "../dist/publish/run.js";

import { ownershipMarkerFromFiles } from "./helpers/ownership_marker.js";

const config = { configPath: "/repo/mokly.config.ts" } as ResolvedConfig;
const options = {
  endpoint: "https://example.com/plan",
  token: "secret",
  repository: "github.com/team/catalogue",
  noChanges: true,
};

function fixture(rounds: "one" | "empty" | "replan" | "replan-empty") {
  let entries: Array<{ path: string; sha256: string; size: number }> = [];
  let plans = 0;
  let completes = 0;
  const updates: PublishUploadProgress[] = [];
  const dependencies: PublishDependencies = {
    git: {
      run: async (args) =>
        args[0] === "symbolic-ref"
          ? "main"
          : args.includes("--show-toplevel")
            ? "/repo"
            : "a".repeat(40),
    },
    now: () => new Date("2026-09-26T12:00:00.000Z"),
    random: () => 0,
    sleep: async () => undefined,
    export: async (_config, selected) => {
      const files = new Map<string, string | Uint8Array>([
        ["index.html", Buffer.alloc(4_198, 1)],
        ["404.html", Buffer.from("Missing")],
      ]);
      const routes = {
        outDir: "/repo/site",
        comparisonUrl: null,
        idRoutes: {},
      };
      await selected.adapter?.transform(files, routes);
      const marker = ownershipMarkerFromFiles(files);
      entries = marker.files;
      files.set(".mokly-export-artifact", JSON.stringify(marker));
      await selected.capture?.(files);
      return { ...routes, deploymentId: "d".repeat(64) };
    },
    fetch: async (url) => {
      if (url === options.endpoint) {
        const round = plans++;
        const selected =
          rounds === "empty" || (rounds === "replan-empty" && round > 0)
            ? []
            : [entries[round === 0 ? 0 : 1]!.sha256];
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: `upload-${plans}`,
            expiresAt: "2026-09-26T13:00:00.000Z",
          },
          missing: selected,
          blobUrl: `https://example.com/blobs/${plans}/{sha256}`,
          completeUrl: `https://example.com/complete/${plans}`,
        });
      }
      if (String(url).includes("/blobs/"))
        return new Response(null, { status: 204 });
      if (rounds.startsWith("replan") && ++completes === 1)
        return new Response(null, { status: 409 });
      return new Response(null, { status: 201 });
    },
    progress: {
      run: async (_phase, action) => action(),
      update: (progress) => updates.push({ ...progress }),
    },
  };
  return { dependencies, entries: () => entries, updates };
}

test("publish progress reports total requested bytes and each completion", async () => {
  const selected = fixture("one");
  await publishCatalogue(config, options, "1.2.3", {}, selected.dependencies);
  const entry = selected.entries()[0]!;
  assert.deepEqual(selected.updates, [
    { completed: 0, total: 1, totalBytes: entry.size },
    { completed: 1, total: 1, totalBytes: entry.size },
  ]);
});

test("empty plans emit no upload progress", async () => {
  const selected = fixture("empty");
  await publishCatalogue(config, options, "1.2.3", {}, selected.dependencies);
  assert.deepEqual(selected.updates, []);
});

test("a re-plan restarts progress for the second missing set", async () => {
  const selected = fixture("replan");
  await publishCatalogue(config, options, "1.2.3", {}, selected.dependencies);
  assert.deepEqual(
    selected.updates.map(({ completed, total }) => [completed, total]),
    [
      [0, 1],
      [1, 1],
      [0, 1],
      [1, 1],
    ],
  );
});

test("a re-plan with no missing blobs restores the base phase label", async () => {
  const selected = fixture("replan-empty");
  await publishCatalogue(config, options, "1.2.3", {}, selected.dependencies);
  assert.deepEqual(
    selected.updates.map(({ completed, total }) => [completed, total]),
    [
      [0, 1],
      [1, 1],
      [0, 0],
    ],
  );
});
