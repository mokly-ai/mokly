import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

export async function createHarness(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/verification-wrapper-"),
  );
  await fs.cp(
    path.join(repositoryRoot, "scripts/verification"),
    path.join(root, "scripts/verification"),
    { recursive: true },
  );
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const files = new Map([
    ["dist/cli/bin.js", ""],
    ["packages/viewer/dist/browser/inspector.js", ""],
    ["examples/basic/generated/mokly-manifest.json", "{}\n"],
    [
      "playwright.config.mjs",
      "export default " +
        JSON.stringify({
          fullyParallel: false,
          outputDir: path.join(root, "playwright-output"),
          projects: [{ name: "chromium" }],
          retries: 0,
          testDir: "tests/browser",
          workers: 1,
        }) +
        ";\n",
    ],
    [
      "tests/browser/passing.spec.ts",
      'import { test } from "@playwright/test";\ntest("real reporter identity", () => {});\n',
    ],
    [
      "tests/failing.test.ts",
      'import test from "node:test";\ntest("retained unit diagnostic", () => {\n  throw new Error("retained unit diagnostic sentinel");\n});\n',
    ],
  ]);
  for (const [name, contents] of files)
    await writeHarnessFile(root, name, contents);
  await fs.mkdir(path.join(root, "packages/viewer/tests"), { recursive: true });
  return root;
}

export async function writeHarnessFile(
  root: string,
  name: string,
  contents: string,
): Promise<void> {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

interface WrapperOptions {
  args?: readonly string[];
  cwd?: string;
  environment?: Readonly<Record<string, string>>;
  report?: string;
}

export async function runWrapper(
  root: string,
  name: string,
  options: WrapperOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const inherited = { ...process.env };
  delete inherited.NODE_TEST_CONTEXT;
  delete inherited.MOKLY_VERIFICATION_REPORT;
  return await execute(
    process.execPath,
    [path.join(root, "scripts/verification", name), ...(options.args ?? [])],
    {
      cwd: options.cwd ?? root,
      env: {
        ...inherited,
        ...options.environment,
        ...(options.report
          ? { MOKLY_VERIFICATION_REPORT: options.report }
          : {}),
        MOKLY_VERIFICATION_RUNTIME: "node-" + process.versions.node,
      },
    },
  );
}
