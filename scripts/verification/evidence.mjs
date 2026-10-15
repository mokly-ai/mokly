import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function discoverNodeFiles(repositoryRoot) {
  const roots = ["tests", "packages/viewer/tests"];
  const files = [];
  for (const root of roots)
    await collectFiles(path.join(repositoryRoot, root), repositoryRoot, files);
  return files.filter((file) => /\.test\.tsx?$/.test(file)).sort();
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

export function defaultReportPath(repositoryRoot) {
  return path.join(
    repositoryRoot,
    ".context/verification-reports",
    `viewer-${process.versions.node}-full.json`,
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
