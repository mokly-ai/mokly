import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import {
  discoverBrowserTests,
  summarizeObservedFiles,
} from "../scripts/verification/playwright.mjs";
import { validateCompletedReport } from "../scripts/verification/report-validation.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { browserTest, unitReport } from "./helpers/verification_evidence.js";

const execute = promisify(execFile);
const LOAD_SENTINEL = "browser discovery load sentinel";
const SHARED_SUITE = "tests/browser/shared_suite.ts";
const SPEC_FILES = ["direct", "first", "second"].map(
  (name) => `tests/browser/${name}.spec.ts`,
);
/** Each test's spec file and defining file in the shared-helper project. */
const ATTRIBUTION = [
  ["tests/browser/direct.spec.ts", "tests/browser/direct.spec.ts"],
  ["tests/browser/first.spec.ts", SHARED_SUITE],
  ["tests/browser/second.spec.ts", SHARED_SUITE],
];

const BROKEN_PROJECT = new Map([
  [
    "tests/browser/broken.spec.ts",
    `import { test } from "@playwright/test";

throw new Error(${JSON.stringify(LOAD_SENTINEL)});

test("never registered", () => {});
`,
  ],
]);

const SHARED_HELPER_PROJECT = new Map([
  [
    SHARED_SUITE,
    `import { test } from "@playwright/test";

export function sharedSuite(name: string): void {
  test(\`\${name} shared case\`, () => {});
}
`,
  ],
  ...["first", "second"].map((name): [string, string] => [
    `tests/browser/${name}.spec.ts`,
    `import { sharedSuite } from "./shared_suite";

sharedSuite(${JSON.stringify(name)});
`,
  ]),
  [
    "tests/browser/direct.spec.ts",
    `import { test } from "@playwright/test";

test("direct case", () => {});
`,
  ],
]);

interface AttributedTest {
  readonly specFile: string;
  readonly file: string;
}

test("a failed browser discovery reports Playwright's load errors", async (context) => {
  const root = await miniatureProject(context, BROKEN_PROJECT);
  await assert.rejects(
    discoverBrowserTests(root),
    (error: unknown) =>
      error instanceof Error &&
      error.message.startsWith("Playwright discovery failed (1)") &&
      error.message.includes(LOAD_SENTINEL),
  );
});

test("browser discovery attributes helper-defined tests to their spec files", async (context) => {
  const root = await miniatureProject(context, SHARED_HELPER_PROJECT);
  const inventory = await discoverBrowserTests(root);
  assert.deepEqual(inventory.files, SPEC_FILES);
  assert.deepEqual(attribution(inventory.tests), ATTRIBUTION);
});

test("the verification reporter attributes helper-defined tests to their spec files", async (context) => {
  const root = await miniatureProject(context, SHARED_HELPER_PROJECT);
  const eventPath = path.join(root, "events.json");
  await execute(
    process.execPath,
    [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      `--reporter=${path.join(repositoryRoot, "scripts/verification/playwright-reporter.mjs")}`,
    ],
    {
      cwd: root,
      env: { ...process.env, MOKLY_PLAYWRIGHT_EVENT_REPORT: eventPath },
    },
  );
  const events = JSON.parse(await fs.readFile(eventPath, "utf8")) as {
    assignedTests: AttributedTest[];
    observedTests: Array<AttributedTest & { durationMs: number }>;
  };
  assert.deepEqual(attribution(events.assignedTests), ATTRIBUTION);
  assert.deepEqual(attribution(events.observedTests), ATTRIBUTION);
  assert.deepEqual(
    summarizeObservedFiles(events.observedTests).map((entry) => [
      entry.file,
      entry.tests,
    ]),
    SPEC_FILES.map((file) => [file, 1]),
  );
});

test("completed browser reports require each test's spec file", () => {
  const file = "tests/browser/a.spec.ts";
  const entry = browserTest("one", file);
  const report = {
    ...unitReport(1, [file]),
    shard: null,
    suite: "browser",
    playwrightFiles: [file],
    fullTests: [entry],
    assignedTests: [entry],
    observedTests: [{ ...entry, durationMs: 1, status: "passed", errors: [] }],
  };
  validateCompletedReport(report);
  assert.throws(
    () =>
      validateCompletedReport({
        ...report,
        fullTests: [{ ...entry, specFile: undefined }],
      }),
    { message: "complete browser test inventory has an invalid specFile" },
  );
});

function attribution(tests: readonly AttributedTest[]): string[][] {
  return tests
    .map((entry) => [entry.specFile, entry.file])
    .sort((left, right) => left.join("\n").localeCompare(right.join("\n")));
}

async function miniatureProject(
  context: TestContext,
  files: ReadonlyMap<string, string>,
): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/browser-discovery-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const config = `export default {
  outputDir: ${JSON.stringify(path.join(root, "playwright-output"))},
  projects: [{ name: "chromium" }],
  testDir: "tests/browser",
};
`;
  for (const [name, contents] of new Map([
    ["playwright.config.mjs", config],
    ...files,
  ])) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return root;
}
