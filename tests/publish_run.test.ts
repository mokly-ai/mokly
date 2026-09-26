import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedConfig } from "../dist/config/types.js";
import {
  publishCatalogue,
  type PublishDependencies,
} from "../dist/publish/run.js";

import { ownershipMarkerFromFiles } from "./helpers/ownership_marker.js";
import { extractUploadArchive } from "./helpers/upload_archive.js";

const head = "a".repeat(40);
const base = "b".repeat(40);
const comparisonPath = `__mokly/diffs/__generations/${"c".repeat(64)}/review.json`;
const config = { configPath: "/repo/tools/mokly.config.ts" } as ResolvedConfig;
const options = {
  endpoint: "https://example.com/upload?scope=catalogue",
  token: "secret",
  repository: "github.com/team/catalogue",
};

function dependencies(duplicate = false) {
  let uploaded = false;
  let metadata: Record<string, unknown> | undefined;
  let planArchive: Map<string, Buffer> | undefined;
  let entries: Array<{ path: string; sha256: string; size: number }> = [];
  const boundaries: PublishDependencies = {
    git: {
      run: async (args) =>
        args[0] === "symbolic-ref"
          ? "feature"
          : args.includes("--show-toplevel")
            ? "/repo"
            : head,
    },
    now: () => new Date("2026-09-26T12:00:00.000Z"),
    random: () => 0,
    sleep: async () => undefined,
    export: async (_config, selected) => {
      const files = new Map<string, string | Uint8Array>([
        ["index.html", "<h1>Consumer catalogue</h1>"],
        ["404.html", "Missing"],
        [
          comparisonPath,
          JSON.stringify({
            schemaVersion: 2,
            baseRef: "origin/main",
            baseCommit: base,
            changedPaths: [],
            ignoredImpact: [],
            screens: [],
            sharedImpact: [],
          }),
        ],
      ]);
      if (duplicate)
        files.set("static/copy.html", "<h1>Consumer catalogue</h1>");
      const routes = {
        outDir: "/repo/site",
        comparisonUrl: `/${comparisonPath}`,
        idRoutes: {},
      };
      await selected.adapter?.transform(files, routes);
      metadata = JSON.parse(String(files.get("mokly-upload.json")));
      const marker = ownershipMarkerFromFiles(files);
      entries = marker.files;
      files.set(
        ".mokly-export-artifact",
        `${JSON.stringify(marker, null, 2)}\n`,
      );
      await selected.capture?.(files);
      return { ...routes, deploymentId: "d".repeat(64) };
    },
    fetch: async (url, init) => {
      if (url === options.endpoint) {
        planArchive = await extractUploadArchive(init?.body as Buffer);
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: "upload-1",
            expiresAt: "2026-09-26T13:00:00.000Z",
          },
          missing: [entries.find(({ path }) => path === "index.html")!.sha256],
          blobUrl: "https://example.com/uploads/upload-1/blobs/{sha256}",
          completeUrl: "https://example.com/uploads/upload-1/complete",
        });
      }
      if (String(url).includes("/blobs/")) {
        uploaded = true;
        return new Response(null, { status: 204 });
      }
      assert.equal(url, "https://example.com/uploads/upload-1/complete");
      return Response.json(
        { viewerUrl: "https://mokly.ai/catalogues/one" },
        { status: 201 },
      );
    },
  };
  return {
    boundaries,
    entries: () => entries,
    metadata: () => metadata,
    planArchive: () => planArchive,
    uploaded: () => uploaded,
  };
}

test("publish exchanges the pinned export and returns counts", async () => {
  const fixture = dependencies();
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(fixture.uploaded(), true);
  assert.deepEqual(result, {
    outcome: "published",
    uploaded: 1,
    unchanged: fixture.entries().length - 1,
    viewerUrl: "https://mokly.ai/catalogues/one",
  });
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
    exportedAt: "2026-09-26T12:00:00.000Z",
    comparisonPath,
  });
  assert.deepEqual(
    [...fixture.planArchive()!.keys()],
    ["mokly-upload.json", ".mokly-export-artifact", comparisonPath],
  );
});

test("one incomplete completion re-plans and unions uploaded digests", async () => {
  const fixture = dependencies();
  let plans = 0;
  let completes = 0;
  fixture.boundaries.fetch = async (url, init) => {
    if (url === options.endpoint) {
      await extractUploadArchive(init?.body as Buffer);
      const selected = fixture.entries()[plans++];
      return Response.json({
        schemaVersion: 1,
        upload: {
          id: `upload-${plans}`,
          expiresAt: "2026-09-26T13:00:00.000Z",
        },
        missing: selected ? [selected.sha256] : [],
        blobUrl: `https://example.com/uploads/${plans}/blobs/{sha256}`,
        completeUrl: `https://example.com/uploads/${plans}/complete`,
      });
    }
    if (String(url).includes("/blobs/"))
      return new Response(null, { status: 204 });
    if (++completes === 1) return new Response(null, { status: 409 });
    return new Response(null, { status: 201 });
  };
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(plans, 2);
  assert.equal(completes, 2);
  assert.equal(result.uploaded, 2);
  assert.equal(result.unchanged, fixture.entries().length - 2);
});

test("entries sharing a digest upload once but both count as uploaded", async () => {
  const fixture = dependencies(true);
  const result = await publishCatalogue(
    config,
    options,
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(result.uploaded, 2);
  assert.equal(result.unchanged, fixture.entries().length - 2);
});

test("blob expiry and local expiry each consume the single re-plan", async () => {
  for (const cause of ["blob-410", "local-expiry"] as const) {
    const fixture = dependencies();
    let plans = 0;
    let blobCalls = 0;
    fixture.boundaries.fetch = async (url) => {
      if (url === options.endpoint) {
        const first = plans++ === 0;
        const entry = fixture.entries()[0]!;
        return Response.json({
          schemaVersion: 1,
          upload: {
            id: `upload-${plans}`,
            expiresAt:
              first && cause === "local-expiry"
                ? "2026-09-26T12:00:00.000Z"
                : "2026-09-26T13:00:00.000Z",
          },
          missing: first ? [entry.sha256] : [],
          blobUrl: `https://example.com/uploads/${plans}/blobs/{sha256}`,
          completeUrl: `https://example.com/uploads/${plans}/complete`,
        });
      }
      if (String(url).includes("/blobs/")) {
        blobCalls++;
        return new Response(null, {
          status: cause === "blob-410" ? 410 : 204,
        });
      }
      return new Response(null, { status: 201 });
    };
    const result = await publishCatalogue(
      config,
      options,
      "1.2.3",
      {},
      fixture.boundaries,
    );
    assert.equal(plans, 2, cause);
    assert.equal(blobCalls, cause === "blob-410" ? 1 : 0, cause);
    assert.equal(result.outcome, "published", cause);
  }
});

test("a second re-plan signal fails the whole command", async () => {
  const fixture = dependencies();
  fixture.boundaries.fetch = async (url) => {
    if (url === options.endpoint)
      return Response.json({
        schemaVersion: 1,
        upload: {
          id: "upload",
          expiresAt: "2026-09-26T13:00:00.000Z",
        },
        missing: [],
        blobUrl: "https://example.com/uploads/upload/blobs/{sha256}",
        completeUrl: "https://example.com/uploads/upload/complete",
      });
    return new Response(null, { status: 410 });
  };
  await assert.rejects(
    publishCatalogue(config, options, "1.2.3", {}, fixture.boundaries),
    /upload-failed/,
  );
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

test("invalid metadata prevents capture and upload", async () => {
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
