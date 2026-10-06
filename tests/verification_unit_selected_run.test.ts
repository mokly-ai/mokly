import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { defaultReportPath } from "../scripts/verification/evidence.mjs";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import {
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

test("one selected file runs alone and prints the partial verification boundary", async (context) => {
  const harness = await createSelectedHarness(context);
  const { stdout } = await runSelected(harness, ["tests/passing.test.ts"]);
  assert.match(stdout, /selected passing sentinel/u);
  assert.doesNotMatch(stdout, /selected failing sentinel/u);
  assert.match(
    stdout,
    /unit tests skipped or todo: 0\nselected files: 1; tests run: 1; partial verification; complete gate: cargo xtask check/u,
  );
  await assert.rejects(fs.stat(path.join(harness.root, "test-ran.marker")), {
    code: "ENOENT",
  });
  await assert.rejects(
    fs.stat(path.join(harness.root, ".context/verification-reports")),
    { code: "ENOENT" },
  );
});

test("a failing selected test fails the process and still prints the run scope", async (context) => {
  const harness = await createSelectedHarness(context);
  await assert.rejects(
    runSelected(harness, ["tests/failing.test.ts"]),
    (error: Error & { code: number; stdout: string }) => {
      assert.notEqual(error.code, 0);
      assert.match(error.stdout, /selected failure sentinel/u);
      assert.match(
        error.stdout,
        /selected files: 1; tests run: 1; partial verification/u,
      );
      return true;
    },
  );
});

test("zero matching tests in a selected file pass with real reporter coverage", async (context) => {
  const harness = await createSelectedHarness(context);
  const { stdout } = await runSelected(harness, [
    "tests/failing.test.ts",
    "--test-name-pattern",
    "no matching title",
  ]);
  assert.match(
    stdout,
    /selected files: 1; tests run: 0; partial verification/u,
  );
  await assert.rejects(fs.stat(path.join(harness.root, "test-ran.marker")), {
    code: "ENOENT",
  });
});

test("a pattern without files uses the whole inventory and leaves no report", async (context) => {
  const harness = await createSelectedHarness(context);
  const { stdout } = await runSelected(harness, [
    "--test-name-pattern=no matching title",
  ]);
  assert.match(
    stdout,
    /selected files: 2; tests run: 0; partial verification/u,
  );
  await assert.rejects(
    fs.stat(path.join(harness.root, ".context/verification-reports")),
    { code: "ENOENT" },
  );
});

test("repeated patterns are alternatives when Node executes them", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("first choice", () => {});\ntest("second choice", () => {});\ntest("excluded", () => { throw new Error("must not run"); });\n',
  );
  const { stdout } = await runSelected(harness, [
    "--test-name-pattern=/^FIRST CHOICE$/i",
    "tests/passing.test.ts",
    "--test-name-pattern",
    "second choice",
  ]);
  assert.match(stdout, /✔ first choice/u);
  assert.match(stdout, /✔ second choice/u);
  assert.doesNotMatch(stdout, /must not run/u);
});

test("argument validation precedes preparation and every test process", async (context) => {
  const harness = await createSelectedHarness(context);
  await fs.rm(path.join(harness.root, "dist"), { recursive: true });
  await writeHarnessFile(harness.root, "helper.test.ts", "");
  for (const args of [
    ["--unknown"],
    ["tests/failing.test.ts", "--test-name-pattern=["],
    ["tests/failing.test.ts", "--test-name-pattern=/alpha/ii"],
    ["tests/missing.test.ts"],
    ["tests/browser/passing.spec.ts"],
    ["helper.test.ts"],
  ]) {
    await assert.rejects(runSelected(harness, args), (error: Error) => {
      assert.doesNotMatch(
        error.message,
        /prepared verification output is missing/u,
      );
      return true;
    });
    await assert.rejects(fs.stat(path.join(harness.root, "test-ran.marker")), {
      code: "ENOENT",
    });
  }
});

test("selected concurrency validation follows arguments and precedes discovery", async (context) => {
  const harness = await createSelectedHarness(context);
  const environment = { MOKLY_UNIT_CONCURRENCY: "0" };
  await assert.rejects(
    runWrapper(harness.root, "run-unit-dev.mjs", {
      args: ["--unknown"],
      environment,
    }),
    /usage: npm test --/u,
  );
  await assert.rejects(
    runWrapper(harness.root, "run-unit-dev.mjs", {
      args: ["tests/failing.test.ts"],
      environment,
    }),
    /MOKLY_UNIT_CONCURRENCY must be a positive integer/u,
  );
  await assert.rejects(fs.stat(path.join(harness.root, "test-ran.marker")), {
    code: "ENOENT",
  });
  await fs.rm(path.join(harness.root, "tests"), { recursive: true });
  await assert.rejects(
    runWrapper(harness.root, "run-unit-dev.mjs", {
      args: ["--test-name-pattern=any"],
      environment,
    }),
    /MOKLY_UNIT_CONCURRENCY must be a positive integer/u,
  );
});

test("selected runs print the shared concurrency override they use", async (context) => {
  const harness = await createSelectedHarness(context);
  const { stdout } = await runWrapper(harness.root, "run-unit-dev.mjs", {
    args: ["tests/passing.test.ts"],
    environment: { MOKLY_UNIT_CONCURRENCY: "3" },
  });
  assert.match(stdout, /unit test files active at once: 3/u);
  assert.match(stdout, /selected passing sentinel/u);
});

for (const present of [true, false]) {
  for (const failing of [false, true]) {
    test(
      "selected runs preserve report paths: present=" +
        present +
        ", failing=" +
        failing,
      async (context) => {
        const harness = await createSelectedHarness(context);
        const defaultPath = defaultReportPath(harness.root, "unit", undefined);
        const override = path.join(harness.root, "custom-report.json");
        const contents = Buffer.from("complete report sentinel\n");
        if (present) {
          for (const file of [defaultPath, override]) {
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, contents);
          }
        }
        const args = [
          failing ? "tests/failing.test.ts" : "tests/passing.test.ts",
        ];
        if (failing) await assert.rejects(runSelected(harness, args, override));
        else await runSelected(harness, args, override);
        for (const file of [defaultPath, override]) {
          if (present) assert.deepEqual(await fs.readFile(file), contents);
          else await assert.rejects(fs.stat(file), { code: "ENOENT" });
        }
        if (present)
          assert.deepEqual(await fs.readdir(path.dirname(defaultPath)), [
            path.basename(defaultPath),
          ]);
        else
          await assert.rejects(fs.stat(path.dirname(defaultPath)), {
            code: "ENOENT",
          });
      },
    );
  }
}
