import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

test(
  "real publish retries exact bytes and preserves deployment identity",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    const server = await exchange({ retry: true });
    const outputs: string[] = [];
    try {
      let deployment: string | undefined;
      for (const mode of ["rich", "plain"]) {
        const result = await publish(root, server.endpoint, mode).result;
        outputs.push(directory(result.stdout));
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        const index = JSON.parse(
          await fs.readFile(
            path.join(outputs.at(-1)!, "mokly-viewer/index.json"),
            "utf8",
          ),
        ) as { deploymentId: string; revision: number; live?: unknown };
        assert.equal(index.revision, 0);
        assert.equal(index.live, undefined);
        if (deployment) assert.equal(index.deploymentId, deployment);
        deployment = index.deploymentId;
        if (mode === "rich") {
          const phases = [
            "Loading configuration",
            "Rendering catalogue",
            "Writing static output",
            "Preparing upload",
            "Uploading catalogue",
            "Published Mokly catalogue",
          ];
          const positions = phases.map((label) => result.stdout.indexOf(label));
          assert.ok(
            positions.every(
              (value, index) =>
                value >= 0 && (index === 0 || value > positions[index - 1]!),
            ),
          );
        } else assert.match(result.stdout, /already published for this commit/);
        assert.ok(!result.stdout.includes("private/a=="));
      }
      assert.equal(server.completed, 2);
      assert.deepEqual(server.bodies[0], server.bodies[1]);
      assert.ok([...server.attempts.values()].every((count) => count === 2));
    } finally {
      await server.close();
      for (const output of outputs) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "SIGINT during Plan cancels publication and retains the complete build",
  { timeout: 120_000, skip: process.platform === "win32" },
  async () => {
    const root = await publicationFixture();
    let interrupt: (() => void) | undefined;
    const server = await exchange({ holdPlan: () => interrupt?.() });
    let output: string | undefined;
    try {
      const running = publish(root, server.endpoint);
      interrupt = () => {
        running.child.kill("SIGINT");
      };
      const result = await running.result;
      output = directory(result.stdout);
      assert.equal(result.code, 1);
      assert.equal(
        result.stderr,
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
      );
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
  "source edits during publish abort before the first receiver request",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    const server = await exchange();
    let output: string | undefined;
    try {
      const result = await publish(root, server.endpoint).result;
      output = directory(result.stdout);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /\[mokly\/export-invalid\].*Inputs changed/);
      assert.equal(server.bodies.length, 0);
      assert.match(
        await fs.readFile(path.join(root, "specs/home.mockup.ts"), "utf8"),
        /\/\/ changed/,
      );
      await assert.rejects(fs.stat(output), { code: "ENOENT" });
    } finally {
      await server.close();
      if (output) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
