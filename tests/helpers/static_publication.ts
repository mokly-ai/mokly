import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const workspace = path.resolve(import.meta.dirname, "../..");

export async function publicationFixture() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-static-publish-"),
  );
  await fs.mkdir(path.join(root, "specs"));
  await fs.writeFile(path.join(root, "mokly.config.json"), "{}");
  await fs.writeFile(
    path.join(root, ".gitignore"),
    "node_modules/\n.context/\nmokly-static/\n",
  );
  await fs.writeFile(path.join(root, "signal.txt"), "original");
  await fs.writeFile(
    path.join(root, "specs", "home.screen.html"),
    "---\ntitle: Home\n---\n<h1>Home</h1>",
  );
  for (const args of [
    ["init", "-q", "--object-format=sha1"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.com"],
    ["add", "."],
    ["commit", "-qm", "fixture"],
  ]) {
    await exec("git", args, { cwd: root });
  }
  return root;
}

function commandEnvironment(mode: string, extra: NodeJS.ProcessEnv) {
  return {
    ...process.env,
    MOKLY_OUTPUT: mode,
    MOKLY_PACKAGE_ROOT: path.join(workspace, "packages/mokly"),
    MOKLY_VIEWER_DIST: path.join(workspace, "packages/viewer/dist"),
    ...extra,
  };
}

export function command(
  root: string,
  verb: "build",
  args: string[],
  mode = "plain",
  extra: NodeJS.ProcessEnv = {},
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const child = spawn(
    process.execPath,
    [path.join(workspace, "packages/mokly/bin/mokly.mjs"), verb, ...args],
    {
      cwd: root,
      env: commandEnvironment(mode, extra),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const result = new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  const stop = () => {
    if (process.platform === "win32" && child.pid !== undefined)
      execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], () => {});
    else child.kill("SIGTERM");
  };
  signal?.addEventListener("abort", stop, { once: true });
  child.once("close", () => signal?.removeEventListener("abort", stop));
  return { child, result };
}
