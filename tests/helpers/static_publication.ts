import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const workspace = path.resolve(import.meta.dirname, "../..");

export async function publicationFixture(
  javascript = false,
  objectFormat: "sha1" | "sha256" = "sha1",
) {
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
    path.join(
      root,
      "specs",
      javascript ? "home.mockup.ts" : "home.screen.html",
    ),
    javascript
      ? `import fs from 'node:fs'; import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render(){fs.appendFileSync('specs/home.mockup.ts','\\n// changed');return '<!doctype html><html><head><title>Home</title></head><body><h1>Home</h1></body></html>'}});`
      : "---\ntitle: Home\n---\n<h1>Home</h1>",
  );
  if (javascript)
    await fs.symlink(
      path.join(workspace, "node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
  for (const args of [
    ["init", "-q", `--object-format=${objectFormat}`],
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
  verb: "build" | "publish",
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
