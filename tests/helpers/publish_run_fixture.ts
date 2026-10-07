import assert from "node:assert/strict";

import type { ResolvedConfig } from "../../dist/config/types.js";
import { type PublishDependencies } from "../../dist/publish/run.js";

import { ownershipMarkerFromFiles } from "./ownership_marker.js";
import { extractUploadArchive } from "./upload_archive.js";

export const head = "a".repeat(40);

export const base = "b".repeat(40);

export const comparisonPath = `mokly-viewer/diffs/generations/${"c".repeat(64)}/review.json`;

export const config = {
  configPath: "/repo/tools/mokly.config.ts",
  generatedDir: "/repo/tools/mockups/mokly-generated",
} as ResolvedConfig;

export const options = {
  endpoint: "https://example.com/upload?scope=catalogue",
  token: "secret",
  repository: "github.com/team/catalogue",
};

export function dependencies(duplicate = false) {
  let uploaded = false;
  let metadata: Record<string, unknown> | undefined;
  let planArchive: Map<string, Buffer> | undefined;
  let entries: Array<{ path: string; sha256: string; size: number }> = [];
  const boundaries: PublishDependencies = {
    git: {
      run: async (args) =>
        args[0] === "status" ||
        args[0] === "ls-files" ||
        args[0] === "check-ignore"
          ? ""
          : args[0] === "symbolic-ref"
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
            schemaVersion: 6 as const,
            baseRef: "origin/main",
            baseCommit: base,
            changedPaths: [],
            ignoredImpact: [],
            screens: [],
            sharedImpact: [],
            components: [],
            changes: [],
            affectedConsumers: [],
          }),
        ],
      ]);
      if (duplicate)
        files.set("static/copy.html", "<h1>Consumer catalogue</h1>");
      const routes = {
        outDir: "/repo/site",
        comparisonUrl: `/${comparisonPath}`,
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
