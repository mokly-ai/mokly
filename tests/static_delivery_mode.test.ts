import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readReport } from "../scripts/verification/evidence.mjs";
import { runCaptured } from "../scripts/verification/process.mjs";
import { checkDeliveryMode } from "../scripts/verification/static-delivery-mode.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const passing = {
  scope: "static-delivery",
  status: "passed",
  expected: ["a", "b"],
  observed: [
    { id: "b", status: "passed" },
    { id: "a", status: "passed" },
  ],
  errors: [],
};

test("delivery acceptance requires complete passing evidence from a zero-exit child", async () => {
  const calls: string[] = [];
  await checkDeliveryMode(
    async () => {
      calls.push("run");
    },
    async () => {
      calls.push("read");
      return passing;
    },
  );
  assert.deepEqual(calls, ["run", "read"]);
  for (const report of [
    undefined,
    null,
    {},
    { ...passing, scope: "browser" },
    { ...passing, status: "failed" },
    { ...passing, errors: ["reporter failed"] },
    { ...passing, expected: [], observed: [] },
    { ...passing, expected: ["a", "a"] },
    { ...passing, expected: ["", "b"] },
    { ...passing, observed: [] },
    { ...passing, observed: [passing.observed[0]] },
    { ...passing, observed: [passing.observed[0], passing.observed[0]] },
    {
      ...passing,
      observed: [passing.observed[0], { id: "other", status: "passed" }],
    },
    {
      ...passing,
      observed: [passing.observed[0], { id: "a", status: "skipped" }],
    },
    { ...passing, observed: [passing.observed[0], null] },
  ])
    await assert.rejects(
      checkDeliveryMode(
        async () => {},
        async () => report,
      ),
    );
  for (const failure of [
    new Error("missing report"),
    new SyntaxError("invalid JSON"),
  ])
    await assert.rejects(
      checkDeliveryMode(
        async () => {},
        async () => {
          throw failure;
        },
      ),
      (error) => error === failure,
    );
});

test("delivery acceptance does not read evidence after a failed child", async () => {
  await assert.rejects(
    checkDeliveryMode(
      async () => {
        throw new Error("child failed");
      },
      async () => {
        throw new Error("must not read");
      },
    ),
    /child failed/,
  );
});

test("a suppressed Playwright report write cannot pass delivery", async (context) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/delivery-parent-"),
  );
  let drained = true;
  context.after(() => {
    if (drained) return fs.rm(root, { recursive: true, force: true });
  });
  const report = path.join(root, "missing-parent", "report.json");
  const config = path.join(root, "playwright.config.mjs");
  await fs.writeFile(
    config,
    `export default ${JSON.stringify({
      testDir: root,
      testMatch: "probe.spec.mjs",
      outputDir: path.join(root, "results"),
      workers: 1,
      retries: 0,
      reporter: [
        [
          path.join(
            repositoryRoot,
            "scripts/verification/static-delivery-reporter.ts",
          ),
        ],
      ],
    })};\n`,
  );
  await fs.writeFile(
    path.join(root, "probe.spec.mjs"),
    'import { test } from "@playwright/test";\ntest.skip("delivery probe", () => {});\n',
  );
  const outcomes: Awaited<ReturnType<typeof runCaptured>>[] = [];
  await assert.rejects(
    checkDeliveryMode(
      async () => {
        drained = false;
        const result = await runCaptured(
          process.execPath,
          [
            path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
            "test",
            "--config",
            config,
          ],
          { cwd: root, env: { ...process.env, MOKLY_DELIVERY_REPORT: report } },
        );
        drained = true;
        outcomes.push(result);
        assert.equal(
          result.exitCode,
          0,
          "Playwright suppresses the reporter callback error",
        );
        assert.match(result.stderr, /Error in reporter.*ENOENT/s);
      },
      () => readReport(report),
    ),
    /ENOENT/,
  );
  assert.equal(outcomes.length, 1);
});
