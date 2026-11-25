/** `npm run build`: the native binary and the workspace packages. */
import { spawn } from "node:child_process";
import path from "node:path";

import { runWorkspaceBuild } from "./workspace-build.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

// npm runs through the Node that started this script, so Windows needs no
// shell and the build uses the npm of `npm run build`.
const npm = process.env.npm_execpath;

/** Run one command at the repository root and resolve its exit status. */
function run([command, ...args]) {
  const [program, programArgs] =
    command === "npm" ? [process.execPath, [npm, ...args]] : [command, args];
  return new Promise((resolve) => {
    const child = spawn(program, programArgs, {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    // A command that cannot start fails its step like a failed command.
    child.once("error", (error) => {
      console.error(`build: ${[command, ...args].join(" ")}: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

if (!npm) {
  console.error("Start the build with npm run build.");
  process.exitCode = 1;
} else {
  const failed = await runWorkspaceBuild(repositoryRoot, {
    run,
    report: (message) => console.error(`build: ${message}`),
  });
  if (failed.length) {
    console.error(`build: failed: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}
