import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { NodeGitCommandRunner } from "../dist/review/git.js";

import { blockingGit, processExists } from "./helpers/blocking_git.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { readProcessField } from "./helpers/process_state.js";

test("the Git runner aborts an active subprocess", async () => {
  const controller = new AbortController();
  const runner = new NodeGitCommandRunner(process.cwd(), controller.signal);
  const command = runner.run(["cat-file", "--batch"]);

  await delay(25);
  controller.abort();

  await assert.rejects(command, { name: "AbortError" });
});

test("aborted Git commands cannot start subprocesses", async () => {
  const controller = new AbortController();
  controller.abort();
  const runner = new NodeGitCommandRunner(process.cwd(), controller.signal);
  await assert.rejects(runner.run(["--version"]), { name: "AbortError" });
  await assert.rejects(runner.runBytes(["--version"]), { name: "AbortError" });
  await assert.rejects(
    runner.runBytesWithInput(["--version"], new Uint8Array()),
    { name: "AbortError" },
  );
});

test(
  "Git cancellation escalates ignored termination and settles after process exit",
  { timeout: 10000, skip: process.platform === "win32" },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const blocked = await blockingGit(fixture, true);
    const controller = new AbortController();
    const runner = new NodeGitCommandRunner(fixture.root, controller.signal);
    const command = assert.rejects(
      runner.run(["rev-parse", "--show-toplevel"]),
      { name: "AbortError" },
    );
    const pid = await blocked.started();
    controller.abort();
    await command;
    assert.equal(processExists(pid), false);
  },
);

test("Git output stays bounded and a rejected command does not poison later reads", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const runner = new NodeGitCommandRunner(fixture.root);
  await runner.run(["init", "-q"]);
  const object = Buffer.from(
    await runner.runBytesWithInput(
      ["hash-object", "-w", "--stdin"],
      Buffer.alloc(64 * 1024 * 1024 + 1, 65),
    ),
  )
    .toString()
    .trim();
  await assert.rejects(
    runner.runBytes(["cat-file", "blob", object]),
    /stdout maxBuffer length exceeded/,
  );
  assert.match(await runner.run(["--version"]), /^git version /);
});

test(
  "Git cancellation stops ordinary helper processes in the command's process group",
  { timeout: 10000, skip: process.platform === "win32" },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const blocked = await blockingGit(fixture, true, true);
    const controller = new AbortController();
    const runner = new NodeGitCommandRunner(fixture.root, controller.signal);
    const command = assert.rejects(
      runner.run(["rev-parse", "--show-toplevel"]),
      { name: "AbortError" },
    );
    const gitPid = await blocked.started();
    const helperPid = await blocked.started(2);
    controller.abort();
    await command;
    assert.equal(processExists(gitPid), false);
    if (processExists(helperPid)) {
      const state = readProcessField(helperPid, "stat");
      if (state !== undefined)
        assert.match(state, /^Z/, "Git helper is still executing");
    }
  },
);
