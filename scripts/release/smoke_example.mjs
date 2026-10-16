/**
 * Pack the viewer, the CLI, and the host's native package; install the
 * archives into a scratch copy of the example outside the repository; serve
 * it through the installed shim and open a React, a design, and an HTML
 * screen in headless Chrome; then build it with `--strict`.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

import { expectedConsoleNotice } from "../../tests/browser/console_notices.js";

import { createPackageArchive } from "./archive.mjs";
import { runCommand } from "./command.mjs";
import { spawnServe } from "./serve_process.mjs";
import { NATIVE_TARGETS } from "./targets.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const CONFIG = ["--config", "examples/basic/mokly.config.json"];

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

/** One screen per authoring kind, with text its desktop view shows. */
const SCREENS = [
  { path: "example/screens/welcome", text: "View details" },
  { path: "design/browse/views/screen", text: "Search catalogue…" },
  { path: "example/team/members", text: "Invite teammate" },
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
    "node_modules/\nsite/\n",
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

/**
 * Serve the copy through the installed shim in its own process group, open
 * the screens, and stop Serve. The group drains on every path, and a normal
 * stop asserts a clean exit.
 */
async function serveAndBrowse(consumer, shim) {
  const server = spawnServe(shim, [...CONFIG, "--no-watch", "--port", "0"], {
    cwd: consumer,
  });
  let browsed = false;
  try {
    await browse(await server.listening(AbortSignal.timeout(600_000)));
    browsed = true;
  } finally {
    const { code } = await server.stop();
    if (browsed) assert.equal(code, 0, server.stderr());
  }
}

/** Open each screen in the Browse shell and wait for its desktop frame. */
async function browse(url) {
  const browser = await chromium.launch(
    process.env.MOKLY_SMOKE_CHROME
      ? {
          executablePath: process.env.MOKLY_SMOKE_CHROME,
          args: ["--no-sandbox"],
        }
      : {},
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    // The shell stub names no icon until the plan's open review item "The
    // shell stub declares no icon" is settled, so the icon request fails.
    const icon = (url) => /^https?:\/\/[^/]+\/favicon\.ico$/u.test(url);
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !expectedConsoleNotice(message) &&
        !icon(message.location().url)
      )
        problems.push(`${message.text()} ${message.location().url}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !icon(response.url()))
        problems.push(`${response.status()} ${response.url()}`);
    });
    // A navigation cancels the open event stream, which is no failure.
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText;
      if (failure !== "net::ERR_ABORTED" && !icon(request.url()))
        problems.push(`${failure} ${request.url()}`);
    });
    for (const screen of SCREENS) {
      await page.goto(`${url}/view/${screen.path}/`, { waitUntil: "load" });
      const frame = page.frameLocator(
        `iframe[src*="/${screen.path}/index.desktop.html"]`,
      );
      await frame
        .getByText(screen.text, { exact: true })
        .first()
        .waitFor({ timeout: 60_000 });
      process.stdout.write(`Served ${screen.path} in the Browse shell.\n`);
    }
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
  }
}

/** Build strictly; assert the site once the static writer writes one. */
async function build(consumer, shim) {
  const { stdout, stderr } = await runCommand(
    process.execPath,
    [shim, "build", ...CONFIG, "--strict", "--no-changes", "--out", "site"],
    { cwd: consumer, env: { MOKLY_OUTPUT: "plain" } },
  );
  process.stdout.write(stdout + stderr);
  const site = path.join(consumer, "site");
  const written = await fs.stat(site).then(
    () => true,
    () => false,
  );
  if (!written) {
    process.stdout.write(
      "mokly build --strict validated the catalogue; it wrote no site, so no static output was checked.\n",
    );
    return false;
  }
  for (const file of [
    "index.html",
    "404.html",
    ...SCREENS.map((screen) => `view/${screen.path}/index.html`),
  ])
    assert.ok((await fs.stat(path.join(site, file))).isFile(), file);
  return true;
}

const scratch = await fs.mkdtemp(
  path.join(os.tmpdir(), "mokly-example-consumer-"),
);
try {
  const packages = await pack(path.join(scratch, "archives"));
  const consumer = path.join(scratch, "example");
  const shim = await install(consumer, packages);
  await serveAndBrowse(consumer, shim);
  const site = await build(consumer, shim);
  process.stdout.write(
    `The packed example served a React, a design, and an HTML screen${site ? " and built its site" : ""}.\n`,
  );
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
