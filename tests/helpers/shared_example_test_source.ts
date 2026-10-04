import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { loadConfig } from "../../dist/config/load.js";

import { EXAMPLE_CONFIG_PATH } from "./example_preparation.js";
import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Small source-only repository using the actual v8 builder for isolation tests. */
export async function createMiniExample(root: string) {
  const basic = path.join(root, "examples/basic");
  await fs.mkdir(path.join(basic, "entries"), { recursive: true });
  const commands = [
    [
      process.execPath,
      path.join(repositoryRoot, "dist/cli/bin.js"),
      "build",
      "--config",
      EXAMPLE_CONFIG_PATH,
    ],
  ];
  await fs.writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await fs.writeFile(
    path.join(root, ".gitignore"),
    ".mokly-cache/\n**/mokly-generated/\nsite/\n",
  );
  await fs.writeFile(
    path.join(root, EXAMPLE_CONFIG_PATH),
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({ repoRoot: "../..", mockupsDir: ".",
entries: ["examples/basic/entries/*.mockup.ts"], review: { baselineBuild: ${JSON.stringify(commands)} } });\n`,
  );
  await fs.writeFile(
    path.join(basic, "entries/home.mockup.ts"),
    `import { defineScreen } from "@mokly/mokly";
export const mockups = [defineScreen({ id: "home", title: "Home", description: "Real test fixture",
dependencies: [], relatedDocs: [], mobile: "<!doctype html><html><body><main>Home</main></body></html>",
desktop: "<!doctype html><html><body><main>Home</main></body></html>" })];\n`,
  );
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  await git("init", "-q", "-b", "main");
  await git("config", "user.name", "Fixture Test");
  await git("config", "user.email", "fixture@example.invalid");
  await git("add", ".");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: source baseline",
  );
  return loadConfig(root, EXAMPLE_CONFIG_PATH);
}

/** All fixture owners drain even when another close reports a failure. */
export async function closeTestExamples(
  ...examples: Array<{ close(): Promise<void> } | undefined>
): Promise<void> {
  const failures: unknown[] = [];
  for (const example of examples)
    await example?.close().catch((error: unknown) => {
      failures.push(error);
    });
  if (failures.length)
    throw new AggregateError(failures, "Test example cleanup failed");
}
