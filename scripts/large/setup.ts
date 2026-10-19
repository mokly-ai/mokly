import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { generateLargeFixture } from "../../tests/fixtures/large/generate.js";
import type {
  LargeSize,
  Variant,
} from "../../tests/fixtures/large/generate.js";

import type { AcceptanceBuild } from "./acceptance_build.js";
import { prepareToolchain } from "./toolchain.js";
import type { ToolchainMode } from "./toolchain.js";

const run = promisify(execFile);
export type PreparedFixture = Awaited<ReturnType<typeof prepareFixture>>;
export async function commitFixture(root: string, stylesheets: number) {
  const git = (...args: string[]) => run("git", args, { cwd: root });
  await git("init", "-q", "-b", "main");
  await git("config", "user.name", "Mokly Fixture");
  await git("config", "user.email", "fixture@example.invalid");
  await git("add", ".");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: large catalogue baseline",
  );
  if (stylesheets > 0)
    await fs.appendFile(
      path.join(root, "assets/shared-1.css"),
      ".scale-unrelated-rule { outline: 1px solid rebeccapurple; }\n",
    );
  return (await git("rev-parse", "HEAD")).stdout.trim();
}
export async function prepareFixture(
  repository: string,
  size: Partial<LargeSize>,
  variant: Variant,
  mode: ToolchainMode,
  root: string,
  acceptanceBuild?: AcceptanceBuild,
) {
  const beginning = performance.now();
  const fixture = await generateLargeFixture(root, size, variant);
  const toolchain = await prepareToolchain(repository, root, mode);
  const baseline = await commitFixture(root, fixture.size.stylesheets);
  const record = {
    ...fixture,
    toolchain,
    baseline,
    ...(acceptanceBuild ? { acceptanceBuild } : {}),
    setupMs: performance.now() - beginning,
  };
  await fs.mkdir(path.join(root, ".context"));
  await fs.writeFile(
    path.join(root, ".context/fixture.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}
export async function preparedFixture(root: string): Promise<PreparedFixture> {
  const fixture = JSON.parse(
    await fs.readFile(path.join(root, ".context/fixture.json"), "utf8"),
  ) as PreparedFixture;
  if (path.resolve(fixture.root) !== path.resolve(root))
    throw new Error("Fixture moved; generate a new fixture");
  await fs.access(fixture.configPath);
  return fixture;
}
