import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { exchange } from "./helpers/static_exchange.js";
import {
  command,
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

const exec = promisify(execFile);
async function commit(root: string) {
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "changed"], { cwd: root });
}

test(
  "environment credentials and nested configuration publish a delta after an entry edit",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(false, "sha256");
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await fs.mkdir(path.join(root, "tools"));
      await fs.writeFile(path.join(root, "tools/mokly.config.json"), "{}");
      await fs.rename(path.join(root, "specs"), path.join(root, "tools/specs"));
      await commit(root);
      for (const change of ["initial", "entry", "unrelated"]) {
        if (change === "entry") {
          await fs.appendFile(
            path.join(root, "tools/specs/home.screen.html"),
            "<p>Changed</p>",
          );
          await commit(root);
        }
        if (change === "unrelated") {
          await fs.appendFile(path.join(root, "signal.txt"), "other input");
          await commit(root);
        }
        const previousBlobAttempts = new Map(server.attempts);
        const result = await publish(root, server.endpoint, "plain", {
          environmentCredentials: true,
          args: ["--config=tools/mokly.config.json"],
        }).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        assert.match(result.stdout, /Published Mokly catalogue/);
        if (change === "unrelated") {
          assert.deepEqual(server.attempts, previousBlobAttempts);
          // The Plan archive still carries the new publication metadata.
          assert.match(result.stdout, /1 file uploaded/);
        }
      }
      assert.equal(server.metadata[0]?.configPath, "tools/mokly.config.json");
      assert.equal(server.metadata[0]?.headSha.length, 64);
      assert.notEqual(server.metadata[0]?.headSha, server.metadata[1]?.headSha);
      assert.ok(server.missingCounts[0]! > server.missingCounts[1]!);
      assert.ok(server.missingCounts[1]! > 0);
      assert.notEqual(server.metadata[1]?.headSha, server.metadata[2]?.headSha);
      assert.equal(server.missingCounts[2], 0);
      assert.equal(server.completed, 3);
    } finally {
      await server.close();
      for (const output of outputs) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "publish warnings name strict only when the user supplied it",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await fs.writeFile(
        path.join(root, "specs/home.screen.html"),
        "---\ntitle: Home\nprops: {label: Unused}\n---\n<p>Home</p>",
      );
      await commit(root);
      for (const strict of [false, true]) {
        const result = await publish(root, server.endpoint, "plain", {
          args: strict ? ["--strict"] : [],
        }).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, 1);
        assert.equal(result.stderr.match(/\[mokly\/warning\]/g)?.length, 1);
        assert.equal(result.stderr.includes("with --strict"), strict);
        if (!strict)
          assert.match(result.stderr, /The catalogue has build warnings/);
      }
      assert.equal(server.bodies.length, 0);
    } finally {
      await server.close();
      for (const output of outputs) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "an invalid output is refused before Git history work and author execution",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await fs.mkdir(path.join(root, "unowned"));
      await fs.writeFile(path.join(root, "unowned/keep"), "keep");
      const result = await command(root, "build", [
        "--out=unowned",
        "--base=absent-ref",
      ]).result;
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/export-invalid\]/);
      assert.ok(!result.stderr.includes("git-failed"));
      assert.equal(
        await fs.readFile(path.join(root, "unowned/keep"), "utf8"),
        "keep",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "timings preserve plain output and diagnostic stacks redact credentials",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      const built = await command(
        root,
        "build",
        ["--no-changes", "--debug-timings"],
        "rich",
      ).result;
      assert.equal(built.code, 0, built.stderr);
      assert.match(built.stdout, /^Built Mokly to/);
      const result = await publish(root, server.endpoint, "rich", {
        args: ["--debug-timings"],
      }).result;
      outputs.push(directory(result.stdout));
      assert.equal(result.code, 0, result.stderr);
      for (const output of [built, result]) {
        const records = output.stderr
          .split("\n")
          .filter((line) => line.startsWith("[mokly:timing] "))
          .map(
            (line) =>
              JSON.parse(line.slice(15)) as { stage: string; event: string },
          );
        assert.ok(records.some((record) => record.stage === "config.load"));
        assert.ok(
          records.some(
            (record) =>
              record.stage === "output.install" && record.event === "end",
          ),
        );
        assert.ok(!output.stdout.includes("✔"));
      }
      assert.ok(result.stderr.includes('"stage":"upload.plan"'));
      await fs.writeFile(
        path.join(root, "mokly.config.json"),
        '{"private/a==":true}',
      );
      const failure = await command(root, "build", ["--no-changes"], "plain", {
        MOKLY_DIAGNOSTIC: "1",
        MOKLY_TOKEN: "private/a==",
      }).result;
      assert.equal(failure.code, 1);
      assert.match(failure.stderr, /Diagnostic stack:/);
      assert.match(failure.stderr, /\[redacted\]/);
      assert.ok(!failure.stderr.includes("private/a=="));
    } finally {
      await server.close();
      for (const output of outputs) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "an older receiver fails the real publication with 426 and retains the build",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    const server = await exchange({ planStatus: 426 });
    let output: string | undefined;
    try {
      const result = await publish(root, server.endpoint, "plain", {
        env: { MOKLY_DIAGNOSTIC: "1" },
      }).result;
      output = directory(result.stdout);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/upload-unsupported-version\]/);
      assert.match(result.stderr, /Diagnostic stack:/);
      assert.ok(!result.stderr.includes("private/a=="));
      assert.equal(server.bodies.length, 1);
      assert.equal(server.attempts.size, 0);
      assert.equal(server.completed, 0);
      assert.ok(
        (await fs.stat(path.join(output, ".mokly-export-artifact"))).isFile(),
      );
    } finally {
      await server.close();
      if (output) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "consumer inspector metadata fails with its document route and build category",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await fs.writeFile(
        path.join(root, "specs/home.screen.html"),
        '---\ntitle: Home\n---\n<a href="#home" data-mokly-inspector-link="0">Home</a><h1 id="home">Home</h1>',
      );
      const result = await command(root, "build", ["--no-changes"]).result;
      assert.equal(result.code, 1);
      assert.match(
        result.stderr,
        /\[mokly\/build-invalid\] home\/index\.(desktop|mobile)\.html: data-mokly-inspector-link is reserved/,
      );
      assert.ok(!result.stderr.includes("[mokly-static"));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
