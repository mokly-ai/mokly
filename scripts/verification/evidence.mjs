import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function discoverNodeFiles(repositoryRoot) {
  const roots = ["tests", "packages/viewer/tests", "packages/ui/tests"];
  const files = [];
  for (const root of roots)
    await collectFiles(path.join(repositoryRoot, root), repositoryRoot, files);
  return files.filter((file) => /\.test\.tsx?$/.test(file)).sort();
}

export async function discoverBrowserFiles(repositoryRoot) {
  const files = [];
  await collectFiles(
    path.join(repositoryRoot, "tests/browser"),
    repositoryRoot,
    files,
  );
  return files.filter((file) => file.endsWith(".spec.ts")).sort();
}

export async function verificationIdentity(repositoryRoot) {
  const sourceCommit = (
    await execute("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot })
  ).stdout.trim();
  const commit = process.env.GITHUB_SHA ?? sourceCommit;
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sourceCommit)
    throw new Error(
      `GITHUB_SHA ${process.env.GITHUB_SHA} does not match checked out ${sourceCommit}`,
    );
  return {
    commit,
    runtime:
      process.env.MOKLY_VERIFICATION_RUNTIME ?? `node-${process.versions.node}`,
    nodeVersion: process.versions.node,
  };
}

export function defaultReportPath(
  repositoryRoot,
  suite = "viewer",
  shard = null,
) {
  return path.join(
    repositoryRoot,
    ".context/verification-reports",
    `${suite}-${process.versions.node}-${shard ? `${shard.index}-of-${shard.total}` : "full"}.json`,
  );
}

export async function writeReport(file, report) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
}

export async function readReport(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function collectFiles(root, repositoryRoot, files) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) await collectFiles(target, repositoryRoot, files);
    else if (entry.isFile())
      files.push(
        path.relative(repositoryRoot, target).split(path.sep).join("/"),
      );
  }
}
