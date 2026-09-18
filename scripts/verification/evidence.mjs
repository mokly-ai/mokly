import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export function parseShardArgument(args) {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== "--shard")
    throw new Error("usage: --shard INDEX/TOTAL");
  const match = /^(\d+)\/(\d+)$/.exec(args[1]);
  if (!match) throw new Error("shard must use one-based INDEX/TOTAL");
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(total) ||
    index < 1 ||
    total < 1 ||
    index > total
  )
    throw new Error("shard must use one-based INDEX/TOTAL with INDEX <= TOTAL");
  return { index, total };
}

export async function discoverUnitFiles(repositoryRoot) {
  const roots = ["tests", "packages/viewer/tests"];
  const files = [];
  for (const root of roots)
    await collectFiles(path.join(repositoryRoot, root), repositoryRoot, files);
  return files.filter((file) => /\.test\.tsx?$/.test(file)).sort();
}

export function nodeShardFiles(files, shard) {
  if (!shard) return [...files];
  return files.filter((_, offset) => offset % shard.total === shard.index - 1);
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

export function defaultReportPath(repositoryRoot, suite, shard) {
  const suffix = shard ? `shard-${shard.index}-of-${shard.total}` : "full";
  return path.join(
    repositoryRoot,
    ".context/verification-reports",
    `${suite}-${process.versions.node}-${suffix}.json`,
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
