import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { GitTrackedGeneratedOutput } from "../dist/build/tracked_output.js";
import { GitProcessError } from "../dist/review/git_process.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

const outside = {
  environment: {},
  files: {
    realpath: async (file: string) => file,
    directory: async () => true,
    exists: async () => false,
  },
};

for (const status of ["true\n", "false\n", "garbage\n"]) {
  test(`Check interprets only the machine work-tree status ${JSON.stringify(status)}`, async (t) => {
    const fixture = await derivedFixture(t);
    const calls: readonly string[][] = [];
    const observed = calls as string[][];
    const tracker = new GitTrackedGeneratedOutput({
      async run(args) {
        observed.push([...args]);
        if (args.includes("--is-inside-work-tree")) return status;
        if (args.includes("--show-toplevel")) return fixture.root;
        if (args[0] === "ls-files") return "";
        throw new Error("unexpected Git call");
      },
    });
    if (status === "garbage\n")
      await assert.rejects(tracker.state(fixture.baseline, fixture.config), {
        code: "build-invalid",
      });
    else
      assert.equal(
        await tracker.state(fixture.baseline, fixture.config),
        "untracked",
      );
    assert.deepEqual(calls[0], ["rev-parse", "--is-inside-work-tree"]);
    assert.equal(
      calls.some((args) => args[0] === "ls-files"),
      status === "true\n",
    );
  });
}

for (const message of [
  "fatal: not a git repository",
  "fatal: Kein Git-Repository",
  "fatal: pas un dépôt git",
]) {
  test(`an ordinary directory is untracked independently of Git diagnostic ${JSON.stringify(message)}`, async (t) => {
    const fixture = await derivedFixture(t);
    const tracker = new GitTrackedGeneratedOutput(
      {
        async run() {
          throw new GitProcessError(128, null, message, "");
        },
      },
      outside,
    );
    assert.equal(
      await tracker.state(fixture.baseline, fixture.config),
      "untracked",
    );
  });
}

for (const reason of [
  "git-file",
  "bare",
  "physical-parent",
  "unreadable",
  "override",
  "stdout",
  "signal",
  "other-exit",
] as const) {
  test(`a ${reason} Git failure never becomes untracked output`, async (t) => {
    const fixture = await derivedFixture(t);
    const physical = path.join(fixture.root, "real", "catalogue");
    const tracker = new GitTrackedGeneratedOutput(
      {
        async run() {
          throw new GitProcessError(
            reason === "other-exit" ? 2 : 128,
            reason === "signal" ? "SIGTERM" : null,
            "fatal: not a git repository",
            reason === "stdout" ? "unexpected output" : "",
          );
        },
      },
      {
        environment: reason === "override" ? { GIT_DIR: "chosen-git-dir" } : {},
        files: {
          directory: async () => true,
          realpath: async (file) =>
            reason === "physical-parent" ? physical : file,
          exists: async (file) => {
            if (reason === "unreadable")
              throw Object.assign(new Error("metadata unavailable"), {
                code: "EACCES",
              });
            if (reason === "git-file")
              return file === path.join(fixture.root, ".git");
            if (reason === "bare")
              return ["HEAD", "objects", "refs"].some(
                (name) => file === path.join(fixture.root, name),
              );
            return (
              reason === "physical-parent" &&
              file === path.join(path.dirname(physical), ".git")
            );
          },
        },
      },
    );
    await assert.rejects(tracker.state(fixture.baseline, fixture.config), {
      code: "build-invalid",
    });
  });
}

test("missing Git keeps its launch cause and gives the specified install remedy", async (t) => {
  const fixture = await derivedFixture(t);
  const failure = Object.assign(new Error("localized launch failure"), {
    code: "ENOENT",
    syscall: "spawn git",
  });
  const tracker = new GitTrackedGeneratedOutput(
    {
      async run() {
        throw failure;
      },
    },
    outside,
  );
  await assert.rejects(tracker.state(fixture.baseline, fixture.config), {
    code: "build-invalid",
    message:
      "[mokly/build-invalid] could not check tracked generated output: Git executable was not found; install Git and retry.",
    cause: failure,
  });
});
