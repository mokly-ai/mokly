import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { prepareFixture } from "../scripts/large/setup.mjs";

import { largeSize } from "./fixtures/large/generate.js";
import { fixtureSetupTree } from "./helpers/file_tree.js";
import { repositoryRoot } from "./helpers/fixture.js";

for (const kind of ["benchmark", "details"])
  for (const phase of ["preparation", "sample"])
    test(
      `SIGINT during ${kind} ${phase} restores every setup source and output before failing`,
      { timeout: 120_000 },
      async (testContext) => {
        const fixture = await prepareFixture(
          repositoryRoot,
          largeSize({
            areas: 1,
            screens: 2,
            rows: 3,
            stylesheets: 1,
            stylesheetShare: 1,
          }),
          false,
        );
        const setup = await fixtureSetupTree(fixture.root);
        const child = spawn(
          process.execPath,
          [
            path.join(
              repositoryRoot,
              "tests/helpers/large_interruption_worker.mjs",
            ),
            repositoryRoot,
            JSON.stringify(fixture),
            kind,
          ],
          {
            cwd: repositoryRoot,
            stdio: ["ignore", "pipe", "pipe"],
            detached: true,
          },
        );
        let output = "";
        child.stdout.on("data", (chunk) => {
          output += chunk;
        });
        child.stderr.on("data", (chunk) => {
          output += chunk;
        });
        const exited = new Promise<{
          code: number | null;
          signal: string | null;
        }>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code, signal) => resolve({ code, signal }));
        });
        testContext.after(async () => {
          if (child.exitCode === null && child.signalCode === null) {
            process.kill(-child.pid!, "SIGKILL");
            await exited;
          }
          await fs.rm(fixture.root, { recursive: true, force: true });
          await fs.rm(
            path.join(repositoryRoot, ".context/large-1-2-3-1-1.json"),
            { force: true },
          );
        });
        const deadline = Date.now() + 60_000;
        while (true) {
          const prepared =
            phase === "sample"
              ? output.includes("Mokly listening at")
              : (
                  await fs.readFile(
                    path.join(fixture.root, "renderer.tsx"),
                    "utf8",
                  )
                ).includes('"rgba(4,5,6,1.00)"');
          if (prepared) break;
          assert.ok(
            child.exitCode === null && child.signalCode === null,
            output,
          );
          assert.ok(Date.now() < deadline, output);
          await setTimeout(10);
        }
        assert.ok(child.kill("SIGINT"));
        const result = await exited;
        assert.notEqual(result.code, 0, output);
        assert.deepEqual(await fixtureSetupTree(fixture.root), setup);
        assert.equal(result.signal, null, output);
        const matrix = output.match(
          kind === "details"
            ? /^Material details (\{.*\})$/m
            : /^Benchmark (\{.*\})$/m,
        );
        assert.ok(matrix, output);
        const recorded = JSON.parse(matrix[1]!);
        assert.equal(recorded.cancelled, true);
        const runs = kind === "details" ? recorded.companions : recorded.runs;
        assert.ok(
          runs.every(
            (run: { scenario: string }) => run.scenario === "component-style",
          ),
        );
        assert.ok(runs.length <= 1);
      },
    );
