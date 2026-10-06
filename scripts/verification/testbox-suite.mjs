import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { constants } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseShardArgument } from "./evidence.mjs";
import { runCaptured, runInherited } from "./process.mjs";
import { parseSourceTreeArguments, readSourceTree } from "./source-tree.mjs";

const SUITES = new Set([
  "repository",
  "package",
  "unit",
  "browser",
  "hydration",
]);
const USAGE =
  "usage: testbox-suite.mjs --expect <fingerprint> --suite <suite> [--shard INDEX/TOTAL]";

/** Validate the suite request and derive its stable command name. */
export function parseTestboxArguments(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !["--expect", "--suite", "--shard"].includes(flag) ||
      values.has(flag) ||
      !value ||
      value.startsWith("--")
    )
      throw new Error(USAGE);
    values.set(flag, value);
  }
  const { expected } = parseSourceTreeArguments([
    "--expect",
    values.get("--expect"),
  ]);
  const suite = values.get("--suite");
  if (!SUITES.has(suite)) throw new Error(`invalid suite; ${USAGE}`);
  const shard = parseShardArgument(
    values.has("--shard") ? ["--shard", values.get("--shard")] : [],
  );
  if (shard && suite !== "unit" && suite !== "browser")
    throw new Error("shard is valid only for unit or browser suites");
  return {
    expected,
    suite,
    ...(shard ? { shard } : {}),
    commandName: shard ? `${suite}-${shard.index}-of-${shard.total}` : suite,
  };
}

/** Run one suite with injected commands, environment and working-tree reads. */
export async function runTestboxSuite(args, dependencies) {
  const request = parseTestboxArguments(args);
  const { cwd, environment, readFingerprint, readFile, writeFile, runCommand } =
    dependencies;
  if (!environment.HOME)
    throw new Error("HOME is required for the Testbox lockfile stamp");
  const env = { ...environment };
  for (const name of [
    "BLACKSMITH_ORG_TOKEN",
    "GITHUB_SHA",
    "GITHUB_ACTIONS",
    "CI",
  ])
    delete env[name];
  const command = (file, commandArgs, captureOutput = false) =>
    runCommand({
      file,
      args: commandArgs,
      cwd,
      env,
      captureOutput,
    });
  const fingerprint = await readFingerprint();
  if (fingerprint !== request.expected)
    throw new Error(
      `source-tree fingerprint does not match: expected ${request.expected}; actual ${fingerprint}`,
    );
  const history = await requireSuccess(
    command("git", ["rev-parse", "--is-shallow-repository"], true),
    "Git shallow check",
  );
  const shallow = history.stdout.trim();
  if (shallow !== "true" && shallow !== "false")
    throw new Error("invalid Git shallow repository response");
  if (shallow === "true")
    await requireSuccess(
      command("git", ["fetch", "--unshallow", "--tags", "origin"]),
      "Git history fetch",
    );

  const digest = createHash("sha256")
    .update(await readFile(path.join(cwd, "package-lock.json")))
    .digest("hex");
  const stampFile = path.join(
    environment.HOME,
    ".mokly-testbox",
    "package-lock.sha256",
  );
  let stamp;
  try {
    stamp = Buffer.from(await readFile(stampFile))
      .toString("utf8")
      .trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (stamp !== digest) {
    await requireSuccess(command("npm", ["ci"]), "npm install");
    await requireSuccess(
      command("npx", ["playwright", "install", "chromium"]),
      "Chromium install",
    );
    await writeFile(stampFile, `${digest}\n`);
  }

  const suiteArgs = [
    "xtask",
    "check",
    "--executor",
    "local",
    "--suite",
    request.suite,
  ];
  if (request.shard)
    suiteArgs.push("--shard", `${request.shard.index}/${request.shard.total}`);
  const outcome = await runCommand({
    file: "cargo",
    args: suiteArgs,
    cwd,
    captureOutput: false,
    env: {
      ...env,
      MOKLY_VERIFICATION_REPORT: `.context/verification-reports/remote/${request.commandName}.json`,
    },
  });
  return outcomeExitCode(outcome);
}

async function requireSuccess(completion, step) {
  const outcome = await completion;
  if (outcomeExitCode(outcome) !== 0) throw new Error(`${step} failed`);
  return outcome;
}

function outcomeExitCode(outcome) {
  const signal = outcome.interrupted || outcome.signal;
  if (signal) return 128 + (constants.signals[signal] ?? 1);
  return outcome.exitCode ?? 1;
}

/** Construct the file and owned-process adapters used by the CLI. */
export function createTestboxDependencies({ cwd, environment }) {
  return {
    cwd,
    environment,
    readFingerprint: () => readSourceTree(cwd),
    readFile: (file) => fs.readFile(file),
    writeFile: async (file, contents) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, contents);
    },
    runCommand: async ({
      file,
      args,
      env,
      cwd: commandRoot,
      captureOutput,
    }) => {
      const options = { cwd: commandRoot, env };
      if (captureOutput) return await runCaptured(file, args, options);
      return {
        ...(await runInherited(file, args, options)),
        stdout: "",
        stderr: "",
      };
    },
  };
}

async function main() {
  process.exitCode = await runTestboxSuite(
    process.argv.slice(2),
    createTestboxDependencies({
      cwd: process.cwd(),
      environment: { ...process.env },
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main().catch((error) => {
    process.stderr.write(`[verification/testbox-suite] ${error.message}\n`);
    process.exitCode = 1;
  });
