import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { run } from "../dist/cli/run.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  registerWarningPage,
  writeWarningPage,
} from "./helpers/link_control_warning_fixture.js";
import { memoryTerminal } from "./helpers/terminal.js";

const warning =
  "[mokly/warning] warning-page/index.html: MockLink child control is inside <button>; one click or key press has two targets\n";

test("build and check report warnings and strict fails before writing", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  execFileSync("git", ["init", "-q", fixture.root]);
  const sourcePath = await registerWarningPage(fixture);
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.equal(compilation.diagnostics.length, 1);

  const built = await invoke(fixture, ["build"]);
  assert.equal(built.code, 0);
  assert.equal(
    built.stdout,
    `Generated ${compilation.outputs.size} Mokly files.\n`,
  );
  assert.equal(built.stderr, warning);
  const lastGood = await treeDigest(fixture.mockupsDir);

  execFileSync("git", ["-C", fixture.root, "add", "-f", fixture.generatedDir]);
  const checked = await invoke(fixture, ["check"]);
  assert.equal(checked.code, 0);
  assert.equal(
    checked.stdout,
    `Mokly output is current (${compilation.outputs.size} files).\n`,
  );
  assert.equal(checked.stderr, warning);

  await writeWarningPage(sourcePath, "Changed label");
  const strictBuild = await invoke(fixture, ["build", "--strict"]);
  assert.equal(strictBuild.code, 1);
  assert.equal(strictBuild.stdout, "");
  assert.equal(
    strictBuild.stderr,
    `${warning}[mokly/build-invalid] 1 build warning with --strict\n`,
  );
  assert.equal(await treeDigest(fixture.mockupsDir), lastGood);

  const strictCheck = await invoke(fixture, ["check", "--strict"]);
  assert.equal(strictCheck.code, 1);
  assert.equal(strictCheck.stdout, "");
  assert.equal(
    strictCheck.stderr,
    `${warning}[mokly/build-invalid] 1 build warning with --strict\n`,
  );
});

async function invoke(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  argv: readonly string[],
): Promise<{ code: number; stderr: string; stdout: string }> {
  const terminal = memoryTerminal({ isTTY: false });
  const reporter = new PlainReporter(terminal.environment);
  let code: number;
  try {
    code = await run(
      [...argv, "--config", fixture.configPath],
      fixture.root,
      terminal.environment,
      reporter,
    );
  } catch (error) {
    reporter.renderError(error, (value) => value);
    code = 1;
  } finally {
    reporter.close();
  }
  return { code, stderr: terminal.stderr(), stdout: terminal.stdout() };
}

async function treeDigest(root: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for (const file of await listFiles(root)) {
    hash.update(path.relative(root, file));
    hash.update(await fs.readFile(file));
  }
  return hash.digest("hex");
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const candidate = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(candidate) : [candidate];
    }),
  );
  return files.flat().sort();
}
