import fs from "node:fs";
import path from "node:path";

import {
  runCommand,
  startCommand,
  stopCommand,
  waitForOutput,
} from "./command.mjs";
import { validatePackageManifest, validateVersionPair } from "./manifest.mjs";

export async function copyFixture(source, root) {
  await fs.promises.cp(source, root, { recursive: true });
}

export async function installConsumer(root, archivePath, packageJson) {
  await fs.promises.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await runCommand(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  const installed = JSON.parse(
    await fs.promises.readFile(
      path.join(root, "node_modules/@mokly/mokly/package.json"),
      "utf8",
    ),
  );
  if (installed.name !== "@mokly/mokly") {
    throw new Error(`consumer did not install ${archivePath}`);
  }
  const viewer = JSON.parse(
    await fs.promises.readFile(
      path.join(root, "node_modules/@mokly/viewer/package.json"),
      "utf8",
    ),
  );
  validatePackageManifest(installed, "@mokly/mokly");
  validatePackageManifest(viewer, "@mokly/viewer");
  validateVersionPair(installed, viewer);
  for (const name of ["mokly", "viewer"]) {
    const stat = await fs.promises.lstat(
      path.join(root, "node_modules/@mokly", name),
    );
    if (stat.isSymbolicLink())
      throw new Error(`consumer installed a ${name} workspace link`);
  }
}

export async function runBin(root, args, options = {}) {
  const bin = path.join(root, "node_modules/.bin/mokly");
  return await runCommand(bin, args, { cwd: options.cwd ?? root });
}

export async function smokeServer(root, args = [], inspect) {
  const bin = path.join(root, "node_modules/.bin/mokly");
  const running = startCommand(
    bin,
    ["serve", "--port", "0", "--no-watch", ...args],
    { cwd: root },
  );
  let failure;
  try {
    const match = await waitForOutput(
      running,
      /Mokly listening at (http:\/\/[^\s]+)/,
      "packed Mokly server",
    );
    const response = await fetch(match[1]);
    if (!response.ok) throw new Error(`server returned ${response.status}`);
    const html = await response.text();
    if (inspect) await inspect(match[1]);
    if (!html.includes("data-mokly-shell")) {
      throw new Error("server response did not contain the Browse shell");
    }
  } catch (error) {
    failure = error;
  }
  const code = await stopCommand(running);
  if (failure !== undefined) throw failure;
  if (code !== 0) throw new Error(`server stopped with code ${code}`);
}

export async function initializeGit(root) {
  await runCommand("git", ["init", "-q"], { cwd: root });
  await runCommand("git", ["config", "user.name", "Mokly Package Smoke"], {
    cwd: root,
  });
  await runCommand(
    "git",
    ["config", "user.email", "mokly-package-smoke@example.invalid"],
    { cwd: root },
  );
  await runCommand("git", ["add", "."], { cwd: root });
  await runCommand("git", ["commit", "-qm", "test: fixture baseline"], {
    cwd: root,
  });
}
