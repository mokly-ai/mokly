/** Explicit source/toolchain setup; derived Serve rebuilds its archived baseline. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  identityFilename,
  moklyIdentity,
  preparationCommand,
  readFixtureIdentity,
  renderingDependencies,
  templateDigest,
} from "./identity.mjs";
import { start, stop } from "./process.mjs";
import { prepareDerivedToolchain } from "./toolchain.mjs";

const run = promisify(execFile);
function fixtureRecord(repository, size, generatedOutput = "committed") {
  return path.join(
    repository,
    ".context",
    `large-${size.areas}-${size.screens}-${size.rows}-${size.stylesheets}-${size.stylesheetShare}${size.inlineStyles ? "-inline-styles" : ""}${generatedOutput === "derived" ? "-derived" : ""}.json`,
  );
}

export async function prepareFixture(
  repository,
  size,
  debug,
  generatedOutput = "committed",
) {
  const { generateLargeFixture } =
    await import("../../tests/fixtures/large/generate.ts");
  const beginning = performance.now();
  const context = path.join(repository, ".context");
  await fs.mkdir(context, { recursive: true });
  const root = await fs.mkdtemp(path.join(context, "mokly-large-"));
  const fixture = await generateLargeFixture(root, size, generatedOutput);
  process.stdout.write(
    `Preparing ${fixture.routes} routes and ${fixture.documents} documents in ${root}\n`,
  );
  if (generatedOutput === "derived")
    await prepareDerivedToolchain(repository, root);
  else {
    const baseline = start(
      [
        path.join(repository, "dist/cli/bin.js"),
        "build",
        "--config",
        fixture.configPath,
        ...(debug ? ["--debug-timings"] : []),
      ],
      root,
    );
    const forward = () => void stop(baseline);
    process.once("SIGINT", forward);
    process.once("SIGTERM", forward);
    try {
      await baseline.done;
    } finally {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
    }
    if (baseline.child.signalCode !== null)
      throw new Error("Fixture setup was interrupted");
  }
  const git = (...args) => run("git", args, { cwd: root });
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
  if (size.stylesheets > 0)
    await fs.appendFile(
      path.join(root, "mockups/assets/shared-1.css"),
      ".scale-unrelated-rule { outline: 1px solid rebeccapurple; }\n",
    );
  const record = {
    ...fixture,
    ...(await moklyIdentity(repository)),
    templateDigest: await templateDigest(
      path.join(repository, "tests/fixtures/large"),
    ),
    fixtureCommit: (await git("rev-parse", "HEAD")).stdout.trim(),
    renderingDependencies: await renderingDependencies(repository, root),
    setupMs: Math.round(performance.now() - beginning),
  };
  await fs.writeFile(
    path.join(root, identityFilename),
    JSON.stringify({
      schemaVersion: 1,
      ...size,
      generatedOutput,
      templateDigest: record.templateDigest,
      moklyCommit: record.moklyCommit,
      moklyDirty: record.moklyDirty,
      fixtureCommit: record.fixtureCommit,
      renderingDependencies: record.renderingDependencies,
    }) + "\n",
  );
  await fs.writeFile(
    fixtureRecord(repository, size, generatedOutput),
    JSON.stringify(record) + "\n",
  );
  process.stdout.write(
    `Fixture setup ${JSON.stringify(record)}\nReady for npm run dev:large or npm run benchmark:large${generatedOutput === "derived" ? " -- --derived" : ""}.\n`,
  );
  return record;
}

export async function preparedFixture(
  repository,
  size,
  generatedOutput = "committed",
  configPath,
) {
  let fixture;
  try {
    fixture = configPath
      ? { configPath, root: path.dirname(configPath) }
      : JSON.parse(
          await fs.readFile(
            fixtureRecord(repository, size, generatedOutput),
            "utf8",
          ),
        );
    await fs.access(fixture.configPath);
  } catch {
    throw new Error(
      `Prepare this fixture first: ${preparationCommand(size, generatedOutput)}`,
    );
  }
  const identity = await readFixtureIdentity(
    repository,
    fixture.root,
    size,
    generatedOutput,
  );
  const actualSize = Object.fromEntries(
    Object.keys(size).map((name) => [name, identity[name]]),
  );
  return {
    ...fixture,
    ...identity,
    size: actualSize,
    routes:
      actualSize.areas *
      (actualSize.screens + 9 + Math.ceil(actualSize.screens / 10)),
    documents: actualSize.areas * (actualSize.screens * 4 + 25),
    preparedMoklyCommit: identity.moklyCommit,
    preparedMoklyDirty: identity.moklyDirty,
    preparedRenderingDependencies: identity.renderingDependencies,
    ...(await moklyIdentity(repository)),
    renderingDependencies: await renderingDependencies(
      repository,
      fixture.root,
    ),
  };
}
