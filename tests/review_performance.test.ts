import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { renderReviewArtifact } from "../dist/review/artifact.js";
import { compareReview } from "../dist/review/compare.js";
import { CommittedRepository } from "../dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const execFileAsync = promisify(execFile);

test("Review batches base viewport reads", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const screens = compilation.manifest.entries.filter(
    (entry) => entry.kind === "screen",
  );
  const files = new Map<string, string>([
    ["mockups/mokly-manifest.json", JSON.stringify(compilation.manifest)],
  ]);
  for (const screen of screens) {
    for (const fragment of Object.values(screen.fragments)) {
      files.set(`mockups/${fragment}`, compilation.outputs.get(fragment) ?? "");
    }
  }
  let batchReads = 0;
  let individualReads = 0;
  let batchedPathCount = 0;
  const git: ReadOnlyReviewRepository = {
    evidence: {
      changedPaths: async () => [],
      mergeBase: async () => "a".repeat(40),
    },
    reader: {
      fileExists: async (_commit, repoPath) => files.has(repoPath),
      fileKind: async (_commit, repoPath) =>
        files.has(repoPath) ? "regular" : "missing",
      readFile: async (_commit, repoPath) => requiredFile(files, repoPath),
      readFileBytes: async (_commit, repoPath) => {
        individualReads += 1;
        return Buffer.from(requiredFile(files, repoPath));
      },
      readFiles: async (_commit, repoRelativePaths) => {
        batchReads += 1;
        batchedPathCount += repoRelativePaths.length;
        return new Map(
          repoRelativePaths.map((repoPath) => [
            repoPath,
            {
              bytes: Buffer.from(requiredFile(files, repoPath)),
              kind: "regular" as const,
            },
          ]),
        );
      },
    },
  };

  await compareReview(compilation, config, git, "HEAD");

  assert.equal(batchReads, 1);
  assert.equal(batchedPathCount, screens.length * 2);
  assert.equal(individualReads, 0);
});

test("Review batches dark base fragments through CommittedRepository", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await git(fixture.root, ["init", "-q"]);
  await git(fixture.root, ["config", "user.name", "Mokly Test"]);
  await git(fixture.root, ["config", "user.email", "mokly@example.invalid"]);
  await git(fixture.root, ["add", "."]);
  await git(fixture.root, ["commit", "-qm", "test: dark base catalogue"]);
  const calls: string[][] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      calls.push([...arguments_]);
      return gitOutput(fixture.root, arguments_);
    },
    runBytesWithInput: async (arguments_, input) => {
      calls.push([...arguments_]);
      return gitBytesWithInput(fixture.root, arguments_, input);
    },
  });

  await compareReview(compilation, config, client, "HEAD");

  const screens = compilation.manifest.entries.filter(
    (entry) => entry.kind === "screen",
  );
  const expected = screens.flatMap((screen) => {
    assert.ok(screen.darkFragments);
    return [
      `mockups/${screen.fragments.mobile}`,
      `mockups/${screen.darkFragments.mobile}`,
      `mockups/${screen.fragments.desktop}`,
      `mockups/${screen.darkFragments.desktop}`,
    ];
  });
  const batchedPathspecs = calls
    .filter((arguments_) => arguments_[0] === "ls-tree")
    .filter((arguments_) => arguments_[1] === "-zl")
    .flatMap((arguments_) => {
      const separator = arguments_.indexOf("--");
      assert.notEqual(separator, -1);
      return arguments_
        .slice(separator + 1)
        .map((pathspec) => pathspec.slice(":(literal)".length));
    });

  assert.deepEqual(
    batchedPathspecs.filter((pathspec) => expected.includes(pathspec)).sort(),
    expected.sort(),
  );
});

test("Git reads regular base files through two batch commands", async () => {
  const regularObject = "b".repeat(40);
  const symlinkObject = "c".repeat(40);
  const regularContent = Buffer.from("content");
  const calls: string[][] = [];
  const client = new CommittedRepository({
    run: async (arguments_) => {
      calls.push([...arguments_]);
      return [
        `100644 blob ${regularObject} 7\tmockups/regular.html`,
        `120000 blob ${symlinkObject} 6\tmockups/linked.html`,
        "",
      ].join("\0");
    },
    runBytesWithInput: async (arguments_, input) => {
      calls.push([...arguments_]);
      assert.equal(Buffer.from(input).toString("utf8"), `${regularObject}\n`);
      return Buffer.concat([
        Buffer.from(`${regularObject} blob 7\n`),
        regularContent,
        Buffer.from("\n"),
      ]);
    },
  });

  const files = await client.reader.readFiles("a".repeat(40), [
    "mockups/regular.html",
    "mockups/linked.html",
    "mockups/missing.html",
  ]);

  assert.deepEqual(files.get("mockups/regular.html"), {
    bytes: regularContent,
    kind: "regular",
  });
  assert.deepEqual(files.get("mockups/linked.html"), { kind: "symlink" });
  assert.deepEqual(files.get("mockups/missing.html"), { kind: "missing" });
  assert.deepEqual(
    calls.map(([command]) => command),
    ["ls-tree", "cat-file"],
  );
  assert.deepEqual(calls[0], [
    "ls-tree",
    "-zl",
    "--full-tree",
    "a".repeat(40),
    "--",
    ":(literal)mockups/linked.html",
    ":(literal)mockups/missing.html",
    ":(literal)mockups/regular.html",
  ]);
});

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

function requiredFile(
  files: ReadonlyMap<string, string>,
  route: string,
): string {
  const value = files.get(route);
  if (value === undefined) throw new Error(`missing fake Git path ${route}`);
  return value;
}

async function git(cwd: string, arguments_: readonly string[]): Promise<void> {
  await execFileAsync("git", [...arguments_], { cwd });
}

async function gitOutput(
  cwd: string,
  arguments_: readonly string[],
): Promise<string> {
  return (await execFileAsync("git", [...arguments_], { cwd })).stdout;
}

async function gitBytesWithInput(
  cwd: string,
  arguments_: readonly string[],
  input: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let inputError: Error | undefined;
    const child = execFile(
      "git",
      [...arguments_],
      { cwd, encoding: "buffer" },
      (error, stdout) => {
        if (error) reject(error);
        else if (inputError) reject(inputError);
        else resolve(Buffer.from(stdout));
      },
    );
    child.stdin?.on("error", (error) => {
      inputError = error;
    });
    child.stdin?.end(Buffer.from(input));
  });
}
