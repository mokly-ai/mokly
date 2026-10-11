import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./helpers/fixture.js";

for (const filter of ["--test-name-pattern=matches-nothing", "--test-only"])
  test(`a filtered file starts no shared fixture: ${filter}`, async (t) => {
    const { root, output, exitCode } = await runFixtureFile(t, [filter]);
    assert.equal(exitCode, 0, output);
    assert.deepEqual(
      (await fs.readdir(root)).sort(),
      ["fixture.test.ts"],
      "setup must not run when no test matches",
    );
    assert.doesNotMatch(output, /asynchronous activity/i);
  });

test("two matching tests share one setup and remove its owned output", async (t) => {
  const { root, output, exitCode } = await runFixtureFile(t, [
    "--test-name-pattern=first|second",
  ]);
  assert.equal(exitCode, 0, output);
  assert.match(output, /# pass 2/);
  assert.deepEqual((await fs.readdir(root)).sort(), [
    "fixture.test.ts",
    "setup-count",
  ]);
  assert.equal(
    await fs.readFile(path.join(root, "setup-count"), "utf8"),
    "setup\n",
  );
  assert.doesNotMatch(output, /asynchronous activity/i);
});

test("failed setup still removes owned output without late activity", async (t) => {
  const { root, output, exitCode } = await runFixtureFile(t, [], true);
  assert.equal(exitCode, 1, output);
  assert.match(output, /setup failed deliberately/);
  assert.match(output, /# fail 2/);
  assert.deepEqual((await fs.readdir(root)).sort(), [
    "fixture.test.ts",
    "setup-count",
  ]);
  assert.equal(
    await fs.readFile(path.join(root, "setup-count"), "utf8"),
    "setup\n",
  );
  assert.doesNotMatch(output, /asynchronous activity/i);
});

async function runFixtureFile(
  t: TestContext,
  filters: readonly string[],
  failSetup = false,
): Promise<{ root: string; output: string; exitCode: number | null }> {
  const contextRoot = path.join(repositoryRoot, ".context");
  await fs.mkdir(contextRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(contextRoot, "file-fixture-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "fixture.test.ts");
  const owned = path.join(root, "owned");
  const marker = path.join(root, "setup-count");
  const helper = pathToFileURL(
    path.join(repositoryRoot, "tests/helpers/file_fixture.ts"),
  ).href;
  await fs.writeFile(
    file,
    `
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { fileFixture } from ${JSON.stringify(helper)};
import type { FixtureOwner } from ${JSON.stringify(helper)};

async function setup(owner: FixtureOwner): Promise<{ root: string }> {
  await fs.mkdir(${JSON.stringify(owned)});
  await fs.appendFile(${JSON.stringify(marker)}, "setup\\n");
  owner.after(() => fs.rm(${JSON.stringify(owned)}, { recursive: true, force: true }));
  ${failSetup ? 'throw new Error("setup failed deliberately");' : `return { root: ${JSON.stringify(owned)} };`}
}
const fixture = fileFixture(setup);
for (const name of ["first", "second"])
  test(name, async () => {
    const value = await fixture();
    assert.equal(value.root, ${JSON.stringify(owned)});
  });
`,
  );
  const args = [
    "--import",
    "tsx",
    "--test",
    "--test-reporter=tap",
    ...filters,
    file,
  ];
  const execArgv: string[] = [];
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [...execArgv, ...args], {
    cwd: repositoryRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  assert.deepEqual(child.spawnargs, [process.execPath, ...args]);
  let output = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    output += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    output += chunk;
  });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal)
        reject(new Error(`Fixture child ended with ${signal}: ${output}`));
      else resolve(code);
    });
  });
  return { root, output, exitCode };
}
