import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { compareReview } from "../dist/review/compare.js";
import { CommittedRepository } from "../dist/review/git.js";
import type { ReadOnlyReviewRepository } from "../dist/review/repository.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

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
      files.set(
        `mockups/${fragment}`,
        textOutput(compilation.outputs, fragment) ?? "",
      );
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
