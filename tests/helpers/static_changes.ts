import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export async function git(root: string, ...args: string[]) {
  return (await exec("git", args, { cwd: root })).stdout.trim();
}
export async function write(root: string, name: string, text: string) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(path.join(root, name), text);
}
