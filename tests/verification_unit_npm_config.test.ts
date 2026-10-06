import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { defaultReportPath } from "../scripts/verification/evidence.mjs";
import { parseUnitSelection } from "../scripts/verification/unit-selection.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { createSelectedHarness } from "./helpers/verification_unit_selected.js";
import {
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

const execute = promisify(execFile);
const consumedFlags = [
  ["npm_config_test_name_pattern", "npm test -- --test-name-pattern=<regex>"],
  ["npm_config_shard", "npm run test:prepared -- --shard INDEX/TOTAL"],
] as const;

for (const [variable, command] of consumedFlags) {
  test(
    "developer arguments reject npm-consumed configuration: " + variable,
    async () => {
      for (const value of ["lockfile", "true", "false", "0", " "]) {
        await assert.rejects(
          parseUnitSelection(
            path.join(os.tmpdir(), "missing-unit-repository"),
            ["--unknown"],
            { [variable]: value },
          ),
          (error: Error) => {
            assert.match(error.message, /npm consumed/u);
            assert.ok(error.message.includes(command));
            return true;
          },
        );
      }
    },
  );

  test(
    "npm-consumed configuration leaves reports and tests untouched: " +
      variable,
    async (context) => {
      const harness = await createSelectedHarness(context);
      const report = path.join(harness.root, "override-report.json");
      const defaultPath = defaultReportPath(harness.root, "unit", undefined);
      const sentinel = "existing complete report\n";
      for (const target of [report, report + ".events", defaultPath]) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, sentinel);
      }
      await fs.rm(path.join(harness.root, "dist"), { recursive: true });
      await assert.rejects(
        runWrapper(harness.root, "run-unit-dev.mjs", {
          report,
          environment: { [variable]: "true" },
        }),
        /npm consumed/u,
      );
      for (const target of [report, report + ".events", defaultPath])
        assert.equal(await fs.readFile(target, "utf8"), sentinel);
      await assert.rejects(
        fs.stat(path.join(harness.root, "test-ran.marker")),
        {
          code: "ENOENT",
        },
      );
    },
  );
}

test("empty and unrelated npm configuration do not select or reject tests", async () => {
  const selection = await parseUnitSelection(
    path.join(os.tmpdir(), "missing-unit-repository"),
    [],
    {
      npm_config_test_name_pattern: "",
      npm_config_shard: "",
      npm_config_color: "true",
    },
  );
  assert.equal(selection.selected, false);
  assert.deepEqual(selection.patterns, []);
  assert.deepEqual(selection.files, []);
});

test("npm omissions of -- fail instead of launching or widening unit tests", async (context) => {
  const harness = await createSelectedHarness(context);
  const { scripts } = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  await writeHarnessFile(
    harness.root,
    "package.json",
    JSON.stringify({
      name: "mokly-npm-consumed-flags",
      private: true,
      scripts: {
        test: scripts.test,
        "test:unit": scripts["test:unit"],
        "prepare:verification": 'node -e ""',
      },
    }),
  );
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.npm_config_test_name_pattern;
  delete environment.npm_config_shard;
  environment.PATH =
    path.dirname(process.execPath) + path.delimiter + (environment.PATH ?? "");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  for (const args of [
    ["test", "--test-name-pattern=lockfile"],
    ["test", "tests/failing.test.ts", "--test-name-pattern=lockfile"],
    ["test", "--shard", "1/4"],
  ]) {
    await assert.rejects(
      execute(npm, args, { cwd: harness.root, env: environment }),
      /npm consumed/u,
    );
    await assert.rejects(fs.stat(path.join(harness.root, "test-ran.marker")), {
      code: "ENOENT",
    });
    await assert.rejects(
      fs.stat(path.join(harness.root, ".context/verification-reports")),
      { code: "ENOENT" },
    );
  }
});
