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
    if (
      !html.includes("/__mokly/client/react-host.js") ||
      html.includes('src="/__mokly/client/react-shell.js"') ||
      html.includes("/__mokly/client/browse.js") ||
      html.includes("/__mokly/client/browser.js")
    )
      throw new Error("server did not deliver the hydrated live shell");
    const hydration = await fetch(`${match[1]}/__mokly/client/react-shell.js`);
    if (!hydration.ok)
      throw new Error(`hydration bundle returned ${hydration.status}`);
    const host = await fetch(`${match[1]}/__mokly/client/react-host.js`);
    const hostCode = await host.text();
    if (
      !host.ok ||
      !hostCode.includes("hydrateRoot") ||
      hostCode.includes("./react-shell.js")
    )
      throw new Error("React host bundle was not self-contained");
    const inspector = await fetch(`${match[1]}/__mokly/client/inspector.js`);
    if (!inspector.ok || (await inspector.arrayBuffer()).byteLength > 9216)
      throw new Error("inspector bundle exceeded its delivery budget");
    if (inspect) {
      await waitForReadyChanges(match[1]);
      await inspect(match[1]);
    }
    if (!html.includes("data-mokly-shell")) {
      throw new Error("server response did not contain the Browse shell");
    }
  } catch (error) {
    failure = error;
  }
  const code = await stopCommand(running);
  if (failure !== undefined) {
    const output = running.output();
    throw new Error(
      `packed Mokly server inspection failed\n${output.stdout}${output.stderr}`,
      { cause: failure },
    );
  }
  if (code !== 0) throw new Error(`server stopped with code ${code}`);
}

async function waitForReadyChanges(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`server returned ${response.status} while preparing`);
    const html = await response.text();
    if (html.includes('data-changes-status="ready"')) return;
    if (html.includes('data-changes-status="unavailable"'))
      throw new Error("packed Mokly comparison became unavailable");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("packed Mokly comparison did not become ready");
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

export async function initializeDerivedGit(root, generatedRoot) {
  await fs.promises.appendFile(
    path.join(root, ".gitignore"),
    `.mokly-cache/\n${generatedRoot}/**/*.html\n${generatedRoot}/mokly-manifest.json\n`,
  );
  await initializeGit(root);
}
