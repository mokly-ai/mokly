import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { GitWorkspace } from "./ratchets/git.mjs";
import {
  lengthFinding,
  parseProtocolCapTable,
} from "./ratchets/length-policy.mjs";

const all = process.argv.includes("--all");
if (process.argv.slice(2).some((argument) => argument !== "--all")) {
  process.stderr.write("usage: source-file-length [--all]\n");
  process.exitCode = 2;
} else {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  const code = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/u;
  const protocol = /^docs\/protocol\/.*\.md$/u;
  const capFile = "xtask/protocol-document-caps.json";
  const capPath = path.join(root, capFile);
  const caps = fs.existsSync(capPath)
    ? parseProtocolCapTable(fs.readFileSync(capPath), capFile)
    : {};
  const files = all ? trackedAndUntracked(root) : changedFiles(root);
  const violations = [...new Set(files)]
    .filter((file) => code.test(file) || protocol.test(file))
    .sort()
    .flatMap((file) => {
      const absolute = path.join(root, file);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile())
        return [];
      const finding = lengthFinding(file, fs.readFileSync(absolute), caps);
      return finding ? [finding] : [];
    });
  if (violations.length) {
    process.stderr.write(
      `Source file-length audit failed:\n${violations.join("\n")}\n`,
    );
    process.exitCode = 1;
  } else
    process.stdout.write(
      `Source file-length audit passed for ${files.length} file(s).\n`,
    );
}

function changedFiles(root) {
  return new GitWorkspace(root).changedFiles(["."]).map(({ path }) => path);
}

function trackedAndUntracked(root) {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
}
