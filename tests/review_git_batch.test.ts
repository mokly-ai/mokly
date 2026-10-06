import assert from "node:assert/strict";
import test from "node:test";

import { CommittedRepository } from "../packages/mokly/dist/review/git.js";

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
