import assert from "node:assert/strict";
import test from "node:test";

import { renderReviewArtifact } from "../dist/review/artifact.js";
import { CommittedRepository } from "../dist/review/git.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

test("Git bounds tree metadata to exact pathspec batches", async () => {
  const paths = Array.from(
    { length: 600 },
    (_, index) =>
      `mockups/screens/screen-${String(index).padStart(4, "0")}.html`,
  );
  const calls: string[][] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      calls.push([...arguments_]);
      return "";
    },
    runBytesWithInput: async () => {
      throw new Error("missing files must not read blobs");
    },
  });

  const files = await client.reader.readFiles("a".repeat(40), paths);

  assert.equal(files.size, paths.length);
  assert.ok(calls.length > 1);
  const pathspecs = calls.flatMap((arguments_) => {
    assert.equal(arguments_[0], "ls-tree");
    assert.equal(arguments_[1], "-zl");
    const separator = arguments_.indexOf("--");
    assert.notEqual(separator, -1);
    return arguments_.slice(separator + 1);
  });
  assert.deepEqual(
    pathspecs,
    paths.map((repoPath) => `:(literal)${repoPath}`),
  );
});

test("Git rejects a blob too large for a bounded batch", async () => {
  const objectId = "d".repeat(40);
  let contentReads = 0;
  const client = new CommittedRepository({
    run: async () =>
      `100644 blob ${objectId} ${48 * 1024 * 1024 + 1}\tmockups/huge.html\0`,
    runBytesWithInput: async () => {
      contentReads += 1;
      return Buffer.alloc(0);
    },
  });

  await assert.rejects(
    client.reader.readFiles("a".repeat(40), ["mockups/huge.html"]),
    /too large.*bounded Git batch/i,
  );
  assert.equal(contentReads, 0);
});

test("Git bounds zero-byte blob batches by object count", async () => {
  const paths = Array.from(
    { length: 4_100 },
    (_, index) => `mockups/empty-${String(index).padStart(4, "0")}.html`,
  );
  const objects = new Map(
    paths.map((repoPath, index) => [
      repoPath,
      index.toString(16).padStart(40, "0"),
    ]),
  );
  const contentBatchSizes: number[] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      const separator = arguments_.indexOf("--");
      return arguments_
        .slice(separator + 1)
        .map((pathspec) => {
          const repoPath = pathspec.slice(":(literal)".length);
          return `100644 blob ${objects.get(repoPath)} 0\t${repoPath}\0`;
        })
        .join("");
    },
    runBytesWithInput: async (_arguments, input) => {
      const objectIds = Buffer.from(input).toString("utf8").trim().split("\n");
      contentBatchSizes.push(objectIds.length);
      return Buffer.concat(
        objectIds.map((objectId) =>
          Buffer.from(`${objectId} blob 0\n\n`, "utf8"),
        ),
      );
    },
  });

  const files = await client.reader.readFiles("a".repeat(40), paths);

  assert.equal(files.size, paths.length);
  assert.ok(contentBatchSizes.length > 1);
  assert.ok(Math.max(...contentBatchSizes) < paths.length);
});

test("Comparison metadata has no per-screen HTML or navigation copies", () => {
  const screens = Array.from({ length: 40 }, (_, index) => ({
    dependencies: [],
    id: `screen-${index}`,
    route: `screens/screen-${index}.html`,
    sharedImpact: [],
    state: "changed" as const,
    title: `Screen ${index}`,
    views: [
      {
        colorScheme: "light" as const,
        ignoredIds: [],
        state: "changed" as const,
        viewport: "mobile" as const,
      },
    ],
  }));
  const result: ReviewResult = {
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    ignoredImpact: [],
    schemaVersion: 2,
    screens,
    sharedImpact: [],
  };

  const files = renderReviewArtifact({ files: new Map(), result });
  assert.deepEqual([...files.keys()].sort(), [
    ".mokly-review-artifact",
    "review.json",
    "summary.md",
  ]);
  const metadata = JSON.parse(String(files.get("review.json"))) as ReviewResult;
  assert.equal(metadata.screens.length, 40);
});
