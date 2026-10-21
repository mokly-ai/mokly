import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  installFixture,
  instrumentManagers,
  managerPath,
  managers,
} from "./helpers/base_manager_tools.js";
import { coldBaseFixture } from "./helpers/cold_base_fixture.js";
import { git, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

const classic = managers[1];

/**
 * A cold Yarn Classic workspace whose nested `packages/app` manifest names
 * its locked archive with `file:`. Classic resolves that value from the
 * manifest folder. With `outside`, the value leaves the repository.
 */
async function nestedFixture(context: TestContext, outside: boolean) {
  const cold = await coldBaseFixture(2, context);
  const { root } = cold;
  await git(root, "checkout", "HEAD", "--", "specs/source-value.ts");
  await fs.rm(path.join(root, "package-lock.json"));
  await fs.rm(path.join(root, "node_modules"), { recursive: true });
  await write(root, ".gitignore", "node_modules/\n.context/\n");
  await write(root, ".yarnrc", "disable-self-update-check true\n");
  const manifests = async (version: string) => {
    const archive = `dependency-${version}.tgz`;
    await fs.mkdir(path.join(root, "packages"), { recursive: true });
    await fs.copyFile(
      path.join(root, "vendor", archive),
      path.join(root, outside ? ".." : "packages", archive),
    );
    await write(
      root,
      "package.json",
      JSON.stringify({
        name: "cold-base-fixture",
        version: "1.0.0",
        private: true,
        packageManager: `yarn@${classic.version}`,
        workspaces: ["packages/*"],
      }),
    );
    await write(
      root,
      "packages/app/package.json",
      JSON.stringify({
        name: "app",
        version: "1.0.0",
        dependencies: {
          "mokly-cold-dependency": `file:${outside ? "../../.." : ".."}/${archive}`,
        },
      }),
    );
  };
  await manifests("1.0.0");
  await installFixture(root, classic, cold.env);
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "nested Classic base fixture");
  await manifests("2.0.0");
  await installFixture(root, classic, cold.env);
  await write(
    root,
    "specs/source-value.ts",
    "export const value = 'Working source';",
  );
  const probe = await instrumentManagers(root);
  const PATH = await managerPath(root, classic, false);
  return {
    root,
    calls: probe.calls,
    output: probe.output,
    network: probe.network,
    env: {
      ...cold.env,
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((key) => key.toLowerCase() === "path")
          .map((key) => [key, PATH]),
      ),
      PATH,
      NODE_OPTIONS: probe.NODE_OPTIONS,
    },
  };
}

async function build(
  fixture: Awaited<ReturnType<typeof nestedFixture>>,
  context: TestContext,
) {
  const result = await command(
    fixture.root,
    "build",
    ["--base=HEAD", "--out=.context/site", "--sidecars=1", "--debug-timings"],
    "plain",
    fixture.env,
    context.signal,
  ).result;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await fs.readFile(fixture.network, "utf8"), "");
  const span = timings(result.stderr).find(
    (record) =>
      record.stage === "review.base-dependencies" && record.event === "end",
  );
  assert.ok(span, result.stderr);
  if (span.tier !== 2)
    context.diagnostic(await fs.readFile(fixture.output, "utf8"));
  const namespace = result.stdout
    .split("\n")
    .find((line) => line.startsWith("Mokly cache: "))
    ?.slice("Mokly cache: ".length);
  return { result, tier: span.tier, namespace };
}

test(
  "a nested Yarn Classic file dependency inside the repository installs on tier two",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await nestedFixture(context, false);
    const { result, tier, namespace } = await build(fixture, context);
    assert.equal(tier, 2, result.stderr);
    assert.doesNotMatch(result.stderr, /base dependencies/u);
    assert.ok(namespace, result.stdout);
    const entries = path.join(namespace, "dependencies/entries");
    const [key] = await fs.readdir(entries);
    assert.match(
      await fs.readFile(
        path.join(
          entries,
          key!,
          "data/node_modules/mokly-cold-dependency/index.js",
        ),
        "utf8",
      ),
      /Base dependency/u,
    );
    const calls = await fs.readFile(fixture.calls, "utf8");
    assert.equal(calls.trim().split("\n").length, 1, calls);
  },
);

test(
  "a nested Yarn Classic file dependency that leaves the repository falls back",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await nestedFixture(context, true);
    const { result, tier } = await build(fixture, context);
    assert.equal(tier, 3, result.stderr);
    assert.match(result.stderr, /local package outside the repository/u);
    assert.equal(await fs.readFile(fixture.calls, "utf8"), "");
  },
);
