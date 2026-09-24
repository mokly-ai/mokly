import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import {
  runWithTimings,
  timeAsync,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { runReview } from "../dist/review/run.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { directoryFiles } from "./helpers/export_fixture.js";
import { repositoryRoot, validEntrySource } from "./helpers/fixture.js";
import {
  assertComparisonCounts,
  assertReviewTimings,
  reviewStages,
  timingEvents,
} from "./helpers/timing_events.js";

const exec = promisify(execFile);
const bin = path.join(repositoryRoot, "dist/cli/bin.js");
const commandOptions = { timeout: 120000, maxBuffer: 16 * 1024 * 1024 };

async function reviewFixture(t: TestContext, components: boolean) {
  const fixture = await changedFixture(
    t,
    components ? componentEntrySource() : validEntrySource(),
    {
      extraConfig:
        'stylesheets: [{ match: "**/*.html", stylesheets: ["shared.css"] }],',
    },
    (fixture) =>
      fs.writeFile(
        path.join(fixture.mockupsDir, "shared.css"),
        ".original { color: green; }\n",
      ),
  );
  await fs.appendFile(
    path.join(fixture.mockupsDir, "shared.css"),
    ".unrelated-private-rule { color: red; }\n",
  );
  const source = await fs.readFile(fixture.entryPath, "utf8");
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      components ? "Screen content" : "Detail</main>",
      components ? "Updated content" : "Updated detail</main>",
    ),
  );
  return fixture;
}

for (const components of [false, true]) {
  test(
    `review timings preserve all exported bytes (components: ${components})`,
    { timeout: 120000 },
    async (t) => {
      const fixture = await reviewFixture(t, components);
      const args = [
        bin,
        "export",
        "--config",
        fixture.configPath,
        "--base",
        "main",
        "--out",
        "site",
      ];
      const normal = await exec(process.execPath, args, commandOptions);
      assert.equal(normal.stderr, "");
      const before = await directoryFiles(path.join(fixture.root, "site"));
      const timed = await exec(
        process.execPath,
        [...args, "--debug-timings"],
        commandOptions,
      );
      assert.equal(timed.stdout, normal.stdout);
      assert.deepEqual(
        await directoryFiles(path.join(fixture.root, "site")),
        before,
      );
      const events = timingEvents(timed.stderr);
      assertReviewTimings(events, "export", "export", [
        ...reviewStages,
        "review.css-analysis",
      ]);
      assert.doesNotMatch(
        timed.stderr,
        /shared\.css|unrelated-private-rule|Screen content|screens\/home/,
      );
      if (components) {
        assertComparisonCounts(events, "export");
        const starts = events.filter((event) => event.event === "start");
        const loop = starts.find(
          (event) => event.stage === "review.compare-screens",
        )!;
        assert.ok(
          starts.some(
            (event) =>
              event.stage === "review.resource-graph" &&
              event.parentId === loop.id,
          ),
        );
      }
    },
  );
}

for (const [components, watch] of [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
] as const) {
  test(
    `Serve review spans retain background parentage (components: ${components}, watch: ${watch})`,
    { timeout: 120000 },
    async (t) => {
      const fixture = await reviewFixture(t, components);
      const child = spawn(
        process.execPath,
        [
          bin,
          "serve",
          "--config",
          fixture.configPath,
          "--base",
          "main",
          "--port",
          "0",
          "--debug-timings",
          ...(watch ? [] : ["--no-watch"]),
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let stderr = "";
      child.stdout.resume();
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      try {
        const deadline = Date.now() + 90000;
        while (
          !timingEvents(stderr).some(
            (event) =>
              event.role === "background" &&
              event.stage === "changes.classify" &&
              event.event === "end",
          )
        ) {
          assert.equal(child.exitCode, null, stderr);
          assert.ok(Date.now() < deadline, stderr);
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      } finally {
        child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
        }
      }
      const events = timingEvents(stderr);
      const backgroundEvents = events.filter(
        (event) => event.role === "background",
      );
      assert.ok(
        events.some(
          (event) =>
            event.role === "serve" && event.stage === "review.base-commit",
        ),
      );
      assertReviewTimings(
        backgroundEvents,
        "background",
        "changes.classify",
        [...reviewStages, "review.css-analysis"].filter(
          (stage) =>
            stage !== "review.write-artifact" && stage !== "review.base-commit",
        ),
      );
      if (components) assertComparisonCounts(events, "background");
      assert.ok(
        !events.some((event) => event.stage === "review.write-artifact"),
      );
      assert.ok(
        !events.some(
          (event) =>
            event.role === "child" && event.stage.startsWith("review."),
        ),
      );
      assert.equal(child.exitCode, 0, stderr);
    },
  );
}

test(
  "owned review writes retain bytes and report write failures without error content",
  { timeout: 120000 },
  async (t) => {
    const fixture = await changedFixture(t);
    const out = fixture.config.review.outDir;
    const normal = await runReview(
      fixture.config,
      "main",
      out,
      committedReviewRepository(fixture.config),
    );
    const before = await directoryFiles(out);
    const events: TimingEvent[] = [];
    const timed = await runWithTimings(
      true,
      "test",
      () =>
        timeAsync("comparison", () =>
          runReview(
            fixture.config,
            "main",
            out,
            committedReviewRepository(fixture.config),
          ),
        ),
      { write: (event) => events.push(event) },
    );
    assert.deepEqual(timed, normal);
    assert.deepEqual(await directoryFiles(out), before);
    assertReviewTimings(events, "test", "comparison");
    await fs.rm(path.join(out, ".mokly-review-artifact"));
    const failed: TimingEvent[] = [];
    await assert.rejects(
      runWithTimings(
        true,
        "test",
        () =>
          timeAsync("comparison", () =>
            runReview(
              fixture.config,
              "main",
              out,
              committedReviewRepository(fixture.config),
            ),
          ),
        { write: (event) => failed.push(event) },
      ),
      /unowned Review directory/,
    );
    assert.ok(
      failed.some(
        (event) =>
          event.stage === "review.write-artifact" &&
          event.event === "end" &&
          event.status === "error",
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(failed),
      /unowned|\.review|screens\/home/,
    );
  },
);
