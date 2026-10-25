/**
 * Pack the viewer, the CLI, and the host's native package; install the
 * archives into a scratch copy of the example outside the repository; serve
 * it through the installed shim from a nested directory and open a React, a
 * design, and an HTML screen and a Markdown document in headless Chrome;
 * build it with `--strict` and open the same entries in the built site; then
 * build it again through npx with an empty npm cache.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { spawnServe } from "../verification/serve-process.mjs";

import { createPackageArchive } from "./archive.mjs";
import { runCommand } from "./command.mjs";
import { browse, browseSite, SCREENS } from "./smoke_example_browser.mjs";
import { npxBuild } from "./smoke_example_npx.mjs";
import { NATIVE_TARGETS } from "./targets.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const CONFIG = ["--config", "examples/basic/mokly.config.json"];
/** Serve starts here and discovers the configuration three directories up. */
const NESTED = "examples/basic/specs/example/team";

/**
 * The example's own imports and their peers. The copy installs the versions
 * the workspace lockfile installed, because a newer release in a range can
 * break the `react-native-web` alias.
 */
const EXAMPLE_DEPENDENCIES = [
  "@firna/ui",
  "@gorhom/bottom-sheet",
  "@tailwindcss/postcss",
  "autoprefixer",
  "lucide-react-native",
  "postcss",
  "react",
  "react-dom",
  "react-native",
  "react-native-gesture-handler",
  "react-native-reanimated",
  "react-native-safe-area-context",
  "react-native-svg",
  "react-native-web",
  "react-native-worklets",
  "tailwindcss",
];

async function pack(destination) {
  const host = NATIVE_TARGETS.find(
    ({ os: system, cpu }) =>
      system === process.platform && cpu === process.arch,
  );
  assert.ok(host, "the packed consumer smoke requires a supported host");
  const packages = [];
  for (const [directory, name] of [
    ["packages/viewer", "@mokly/viewer"],
    ["packages/mokly", "@mokly/mokly"],
    [host.directory, host.name],
  ])
    packages.push(
      await createPackageArchive(
        path.join(repositoryRoot, directory),
        destination,
        name,
      ),
    );
  return packages;
}

async function installedVersion(name) {
  const manifest = path.join(
    repositoryRoot,
    "node_modules",
    name,
    "package.json",
  );
  return [name, JSON.parse(await fs.readFile(manifest, "utf8")).version];
}

/**
 * Copy the example with the repository pages its documents link to, and
 * install the archives, not the workspace links. The copy keeps the
 * repository layout, so the configuration's `repoRoot`, the example's asset
 * outside its catalogue root, and those links resolve as they do here.
 */
async function install(consumer, packages) {
  for (const directory of ["examples", "docs", "plans"])
    await fs.cp(
      path.join(repositoryRoot, directory),
      path.join(consumer, directory),
      {
        recursive: true,
        filter: (source) =>
          !/(^|[\\/])(node_modules|mokly-generated)$/u.test(source),
      },
    );
  await fs.writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: Object.fromEntries([
          ...packages.map(({ archivePath, report }) => [
            report.name,
            `file:${archivePath}`,
          ]),
          ...(await Promise.all(EXAMPLE_DEPENDENCIES.map(installedVersion))),
        ]),
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(consumer, ".gitignore"),
    "node_modules/\nsite/\nnpx-site/\n",
  );
  await runCommand("git", ["init", "--quiet"], { cwd: consumer });
  await runCommand(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer },
  );
  for (const { report } of packages) {
    const installed = path.join(consumer, "node_modules", report.name);
    assert.equal((await fs.lstat(installed)).isSymbolicLink(), false);
    const manifest = JSON.parse(
      await fs.readFile(path.join(installed, "package.json"), "utf8"),
    );
    assert.equal(manifest.version, report.version, report.name);
  }
  return path.join(consumer, "node_modules/@mokly/mokly/bin/mokly.mjs");
}

/** Serve's process group did not drain; the scratch directory stays. */
class DrainFailure extends AggregateError {}

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

/**
 * Serve the copy through the installed shim in its own process group from a
 * directory below the configuration's, open the entries, and stop Serve. The
 * group drains on every path, also on an interrupt, and a normal stop asserts
 * a clean exit.
 */
async function serveAndBrowse(consumer, shim) {
  const server = await spawnServe(
    shim,
    ["--no-watch", "--port", "0", "--sidecars", "1"],
    { cwd: path.join(consumer, NESTED) },
  );
  const interrupt = (signal) =>
    server.stop().then(
      () => process.exit(128 + os.constants.signals[signal]),
      () => process.exit(1),
    );
  for (const signal of SIGNALS) process.once(signal, interrupt);
  let failure;
  try {
    await browse(
      await server.listening(AbortSignal.timeout(600_000)),
      "Served",
    );
  } catch (error) {
    failure = error;
  }
  let outcome;
  try {
    outcome = await server.stop();
  } catch (error) {
    throw new DrainFailure(
      failure ? [failure, error] : [error],
      "Serve did not drain",
    );
  } finally {
    for (const signal of SIGNALS) process.off(signal, interrupt);
  }
  if (failure) throw failure;
  assert.equal(outcome.code, 0, server.stderr());
}

/**
 * Build strictly with an explicit `--config` into `site/` beside the copy's
 * `examples/`: a relative `--out` resolves against the configuration's
 * directory. Check the home, not-found, and shell route files, then open the
 * entries from the site.
 */
async function buildAndBrowse(consumer, shim) {
  const { stdout, stderr } = await runCommand(
    process.execPath,
    [
      shim,
      "build",
      ...CONFIG,
      "--strict",
      "--no-changes",
      "--sidecars",
      "1",
      "--out",
      "../../site",
    ],
    { cwd: consumer, env: { MOKLY_OUTPUT: "plain" } },
  );
  process.stdout.write(stdout + stderr);
  const site = path.join(consumer, "site");
  for (const file of [
    "index.html",
    "404.html",
    ...SCREENS.map((screen) => `view/${screen.path}/index.html`),
  ])
    assert.ok((await fs.stat(path.join(site, file))).isFile(), file);
  await browseSite(site);
}

const scratch = await fs.mkdtemp(
  path.join(os.tmpdir(), "mokly-example-consumer-"),
);
let keep = false;
try {
  const packages = await pack(path.join(scratch, "archives"));
  const consumer = path.join(scratch, "example");
  const shim = await install(consumer, packages);
  await serveAndBrowse(consumer, shim);
  await buildAndBrowse(consumer, shim);
  await npxBuild(consumer, packages, scratch);
  process.stdout.write(
    "The packed example served three screens and a document, built them, and built them through npx.\n",
  );
} catch (error) {
  keep = error instanceof DrainFailure;
  throw error;
} finally {
  if (keep)
    process.stderr.write(
      `Kept ${scratch} for diagnosis: Serve did not drain.\n`,
    );
  else await fs.rm(scratch, { recursive: true, force: true });
}
