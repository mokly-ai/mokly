import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
  const files = all ? trackedAndUntracked(root) : changedFiles(root);
  const violations = [...new Set(files)]
    .filter((file) => code.test(file) || protocol.test(file))
    .sort()
    .flatMap((file) => {
      const absolute = path.join(root, file);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile())
        return [];
      const source = fs.readFileSync(absolute, "utf8");
      const lines =
        source === ""
          ? 0
          : source.split(/\r?\n/u).length - Number(source.endsWith("\n"));
      const limit = protocol.test(file) ? 250 : 300;
      return lines > limit ? [`${file}: ${lines} lines (limit ${limit})`] : [];
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
  const mergeHead = execFileSync(
    "git",
    ["rev-parse", "--git-path", "MERGE_HEAD"],
    {
      cwd: root,
      encoding: "utf8",
    },
  ).trim();
  const merging = fs.existsSync(path.resolve(root, mergeHead));
  const commands = merging
    ? [
        ["diff", "--name-only", "-z", "origin/main"],
        ["ls-files", "--others", "--exclude-standard", "-z"],
      ]
    : [
        ["diff", "--name-only", "-z", "origin/main...HEAD"],
        ["diff", "--name-only", "-z", "HEAD"],
        ["ls-files", "--others", "--exclude-standard", "-z"],
      ];
  return commands.flatMap((arguments_) =>
    execFileSync("git", arguments_, { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean),
  );
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
