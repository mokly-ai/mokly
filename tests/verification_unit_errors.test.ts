import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import {
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

interface FailedChild extends Error {
  code: number;
  stderr: string;
  stdout: string;
}

function expectedReport(message: string | RegExp) {
  return (error: FailedChild): boolean => {
    assert.equal(error.code, 1);
    if (typeof message === "string") assert.equal(error.stderr, message);
    else assert.match(error.stderr, message);
    assert.doesNotMatch(error.stderr, / {4}at |Node\.js v/u);
    return true;
  };
}

for (const [args, message] of [
  [["--unknown"], /^unknown option --unknown\nusage: npm test --/u],
  [
    ["--test-name-pattern"],
    /^--test-name-pattern needs a non-empty value\nusage:/u,
  ],
  [
    ["--test-name-pattern="],
    /^--test-name-pattern needs a non-empty value\nusage:/u,
  ],
  [
    ["tests/missing.test.ts"],
    /^Cannot read test file argument: tests\/missing\.test\.ts\n$/u,
  ],
  [["tests"], /^Test file argument is not a file: tests\n$/u],
  [["../outside.test.ts"], /^Test file argument is outside the repository:/u],
  [
    ["tests/browser/passing.spec.ts"],
    /use npm run test:browser -- tests\/browser\/passing\.spec\.ts/u,
  ],
  [
    ["--shard", "1/4"],
    /use npm run test:prepared or cargo xtask check --suite unit --shard/u,
  ],
  [
    ["helper.test.ts"],
    /^Test file argument is outside the unit inventory: helper\.test\.ts\n$/u,
  ],
] as const) {
  test(
    "developer argument errors have no stack: " + JSON.stringify(args),
    async (context) => {
      const harness = await createSelectedHarness(context);
      await writeHarnessFile(harness.root, "helper.test.ts", "");
      await assert.rejects(runSelected(harness, args), expectedReport(message));
    },
  );
}

test("invalid regex reports the value and Node's syntax error before usage", async (context) => {
  const harness = await createSelectedHarness(context);
  await assert.rejects(
    runSelected(harness, ["--test-name-pattern=["]),
    (error: FailedChild) => {
      expectedReport(/^invalid --test-name-pattern value "\[": /u)(error);
      assert.match(
        error.stderr,
        /Invalid regular expression:.*Unterminated character class/u,
      );
      assert.match(error.stderr, /\nusage: npm test --/u);
      return true;
    },
  );
});

test("invalid pattern values preserve typed backslashes inside quotes", async (context) => {
  const harness = await createSelectedHarness(context);
  const value = String.raw`foo\.bar(`;
  await assert.rejects(
    runSelected(harness, ["--test-name-pattern=" + value]),
    (error: FailedChild) => {
      assert.ok(
        error.stderr.startsWith(
          'invalid --test-name-pattern value "' + value + '": ',
        ),
      );
      assert.match(error.stderr, /Unterminated group/u);
      assert.match(error.stderr, /\nusage:/u);
      assert.doesNotMatch(error.stderr, / {4}at |Node\.js v/u);
      return true;
    },
  );
});

test("selected test failure ends with its count and reporter names without a stack", async (context) => {
  const harness = await createSelectedHarness(context);
  await assert.rejects(
    runSelected(harness, ["tests/failing.test.ts"]),
    expectedReport(
      "1 selected unit test failed:\n✖ selected failing sentinel\n",
    ),
  );
});

test("selected test failure names preserve order and stop after twenty", async (context) => {
  const harness = await createSelectedHarness(context);
  const names = Array.from(
    { length: 23 },
    (_, index) => "failure " + (index + 1),
  );
  await writeHarnessFile(
    harness.root,
    "tests/failing.test.ts",
    'import test from "node:test";\n' +
      names
        .map(
          (name) =>
            `test(${JSON.stringify(name)}, () => { throw new Error("sentinel"); });`,
        )
        .join("\n"),
  );
  await assert.rejects(
    runSelected(harness, ["tests/failing.test.ts"]),
    expectedReport(
      "23 selected unit tests failed:\n" +
        names
          .slice(0, 20)
          .map((name) => "✖ " + name)
          .join("\n") +
        "\n… and 3 more\n",
    ),
  );
});

test("incomplete selected reporter keeps the internal stack report", async (context) => {
  const harness = await createSelectedHarness(context);
  const reporter = path.join(
    harness.root,
    "scripts/verification/node-reporter.mjs",
  );
  const source = await fs.readFile(reporter, "utf8");
  await fs.writeFile(
    reporter,
    source.replace("reporterComplete = true;", "reporterComplete = false;"),
  );
  await assert.rejects(
    runSelected(harness, ["tests/passing.test.ts"]),
    (error: FailedChild) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Node reporter did not complete/u);
      assert.match(error.stderr, / {4}at /u);
      assert.match(error.stderr, /Node\.js v/u);
      return true;
    },
  );
});

test("file-set faults name missing and unexpected files and keep a stack", async (context) => {
  const harness = await createSelectedHarness(context);
  const reporter = path.join(
    harness.root,
    "scripts/verification/node-reporter.mjs",
  );
  const source = await fs.readFile(reporter, "utf8");
  await fs.writeFile(
    reporter,
    source.replace(
      "summaries.push(event.data)",
      'summaries.push({ ...event.data, file: event.data.file.replace("passing.test.ts", "unexpected.test.ts") })',
    ),
  );
  await assert.rejects(
    runSelected(harness, ["tests/passing.test.ts"]),
    (error: FailedChild) => {
      assert.match(error.stderr, /missing: tests\/passing\.test\.ts/u);
      assert.match(error.stderr, /unexpected: tests\/unexpected\.test\.ts/u);
      assert.match(error.stderr, / {4}at /u);
      return true;
    },
  );
});

test("empty inventory remains an internal error in the developer runner", async (context) => {
  const harness = await createSelectedHarness(context);
  await fs.rm(path.join(harness.root, "tests"), { recursive: true });
  await fs.mkdir(path.join(harness.root, "tests"));
  await assert.rejects(
    runWrapper(harness.root, "run-unit-dev.mjs", {
      args: ["--test-name-pattern=any"],
    }),
    (error: FailedChild) => {
      assert.match(error.stderr, /unit test discovery was empty/u);
      assert.match(error.stderr, / {4}at /u);
      return true;
    },
  );
});

test("cancelled selected tests report the count before the process exit", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("cancelled", { timeout: 10 }, () => new Promise(() => {}));\n',
  );
  await assert.rejects(
    runSelected(harness, ["tests/passing.test.ts"]),
    expectedReport("1 selected unit test cancelled:\n✖ cancelled\n"),
  );
});

for (const [exitCode, signal, message] of [[17, null, "code 17"]] as const) {
  test("selected process failure names " + message, async (context) => {
    const harness = await createSelectedHarness(context);
    const processFile = path.join(
      harness.root,
      "scripts/verification/process.mjs",
    );
    const source = await fs.readFile(processFile, "utf8");
    const before = "return { ...outcome, interrupted };";
    assert.ok(source.includes(before));
    await fs.writeFile(
      processFile,
      source.replace(
        before,
        `return { ...outcome, interrupted, exitCode: ${JSON.stringify(exitCode)}, signal: ${JSON.stringify(signal)} };`,
      ),
    );
    await assert.rejects(
      runSelected(harness, ["tests/passing.test.ts"]),
      expectedReport(
        "selected unit test process exited with " + message + "\n",
      ),
    );
  });
}
