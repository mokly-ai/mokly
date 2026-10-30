/** The install and build steps that `npm run dev` runs before Serve starts. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { prepareDevelopment } from "../scripts/dev-preparation.mjs";
import { missingPreparedOutputs } from "../scripts/verification/prepared.mjs";

const first = new Date("2026-10-01T09:00:00Z");
const second = new Date("2026-10-02T09:00:00Z");
/** The time at which a simulated `npm ci` completes. */
const third = new Date("2026-10-03T09:00:00Z");
const installRecord = "node_modules/.package-lock.json";

interface Checkout {
  /** The time of the last change to package-lock.json. */
  locked: Date;
  /** The time of npm's record of the last install, or no install. */
  installed?: Date;
  /** The time of every build output that exists. */
  built?: Date;
  /** Which build outputs exist, in the order of the output list. */
  outputs: "none" | "all but the last" | "all";
}

/** Write a checkout and return its root and its complete output list. */
async function checkout(
  t: TestContext,
  { locked, installed, built = first, outputs }: Checkout,
): Promise<{ root: string; outputs: string[] }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-dev-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const list = await missingPreparedOutputs(root, { browser: true });
  const present =
    outputs === "none" ? [] : outputs === "all" ? list : list.slice(0, -1);
  for (const output of present) await write(path.join(root, output), built);
  await write(path.join(root, "package-lock.json"), locked);
  if (installed) await write(path.join(root, installRecord), installed);
  return { root, outputs: list };
}

async function write(file: string, time: Date): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "{}\n");
  await fs.utimes(file, time, time);
}

/**
 * Record each npm command and progress line. A successful `npm ci` writes the
 * install record, as npm does. The failing command exits with status 1.
 */
function recorder(root: string, failing?: string) {
  const commands: string[][] = [];
  const reports: string[] = [];
  const preparation = {
    run: async (args: readonly string[]) => {
      commands.push([...args]);
      if (args.join(" ") === failing) return 1;
      if (args.join(" ") === "ci")
        await write(path.join(root, installRecord), third);
      return 0;
    },
    report: (message: string) => {
      reports.push(message);
    },
  };
  return { commands, reports, preparation };
}

const cases: {
  name: string;
  checkout: Checkout;
  commands: string[][];
  reports: (outputs: string[]) => string[];
}[] = [
  {
    name: "a checkout without an install installs, then builds",
    checkout: { locked: first, outputs: "none" },
    commands: [["ci"], ["run", "build"]],
    reports: (outputs) => [
      "Installing dependencies with npm ci, because they are not installed.",
      `Building with npm run build, because ${outputs[0]} is missing.`,
    ],
  },
  {
    name: "a lockfile newer than the install installs and builds again",
    checkout: { locked: second, installed: first, outputs: "all" },
    commands: [["ci"], ["run", "build"]],
    reports: () => [
      "Installing dependencies with npm ci, because package-lock.json changed after the last install.",
      "Building with npm run build, because the dependencies changed after the last build.",
    ],
  },
  {
    name: "an install newer than the build builds again",
    checkout: { locked: first, installed: second, outputs: "all" },
    commands: [["run", "build"]],
    reports: () => [
      "Building with npm run build, because the dependencies changed after the last build.",
    ],
  },
  {
    name: "a missing build output builds without an install",
    checkout: {
      locked: first,
      installed: second,
      built: second,
      outputs: "all but the last",
    },
    commands: [["run", "build"]],
    reports: (outputs) => [
      `Building with npm run build, because ${outputs.at(-1)} is missing.`,
    ],
  },
  {
    name: "an install and a build as recent as their inputs run nothing",
    checkout: { locked: first, installed: first, outputs: "all" },
    commands: [],
    reports: () => [],
  },
];

for (const scenario of cases) {
  test(`dev preparation: ${scenario.name}`, async (t) => {
    const { root, outputs } = await checkout(t, scenario.checkout);
    const record = recorder(root);
    await prepareDevelopment(root, record.preparation);
    assert.deepEqual(record.commands, scenario.commands);
    assert.deepEqual(record.reports, scenario.reports(outputs));
  });
}

test("dev preparation stops at a failed install and runs no build", async (t) => {
  const { root } = await checkout(t, { locked: first, outputs: "none" });
  const record = recorder(root, "ci");
  await assert.rejects(prepareDevelopment(root, record.preparation), {
    name: "ExpectedFailure",
    message: "npm run dev stopped, because npm ci failed.",
  });
  assert.deepEqual(record.commands, [["ci"]]);
});
