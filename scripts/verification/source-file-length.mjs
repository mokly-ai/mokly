import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const all = process.argv.includes("--all");
if (process.argv.slice(2).some((argument) => argument !== "--all")) {
  process.stderr.write("usage: source-file-length [--all]\n");
  process.exitCode = 2;
} else {
  const root = process.cwd();
  const directories = [
    "src",
    "scripts",
    "tests",
    "packages/viewer/src",
    "docs/protocol",
  ];
  const code =
    /^(?:src|scripts|tests|packages\/viewer\/src)\/.*\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
  const protocol = /^docs\/protocol\/.*\.md$/u;
  const files = all
    ? directories.flatMap((directory) => visit(path.join(root, directory)))
    : changedFiles(directories);
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

function changedFiles(directories) {
  const commands = [
    ["diff", "--name-only", "-z", "origin/main...HEAD", "--", ...directories],
    ["diff", "--name-only", "-z", "HEAD", "--", ...directories],
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ...directories],
  ];
  return commands.flatMap((arguments_) =>
    execFileSync("git", arguments_, { encoding: "utf8" })
      .split("\0")
      .filter(Boolean),
  );
}

function visit(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(candidate);
    return entry.isFile()
      ? [path.relative(process.cwd(), candidate).split(path.sep).join("/")]
      : [];
  });
}
