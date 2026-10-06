import fs from "node:fs/promises";
import path from "node:path";

const usage = [
  "usage: npm test -- [<file> ...] [<pattern> ...]",
  "       npm run test:unit -- [<file> ...] [<pattern> ...]",
  "pattern: --test-name-pattern=<regex> | --test-name-pattern <regex>",
].join("\n");
const patternFlag = "--test-name-pattern";

/** Validate developer arguments and paths before inventory discovery. */
export async function parseUnitSelection(
  repositoryRoot,
  argv,
  environment = process.env,
) {
  rejectConsumedNpmFlags(environment);
  const argumentsForFiles = [];
  const patterns = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--shard" || argument.startsWith("--shard="))
      throw new Error(
        "Developer runs do not accept --shard; use npm run test:prepared or cargo xtask check --suite unit --shard INDEX/TOTAL.",
      );
    if (argument === patternFlag) {
      patterns.push(requirePattern(argv[++index]));
    } else if (argument.startsWith(patternFlag + "=")) {
      patterns.push(requirePattern(argument.slice(patternFlag.length + 1)));
    } else if (argument.startsWith("-")) {
      throw new Error(usage);
    } else {
      argumentsForFiles.push(argument);
    }
  }

  const files = [];
  const seen = new Set();
  for (const argument of argumentsForFiles) {
    const absolute = path.resolve(
      repositoryRoot,
      argument.replaceAll("\\", "/"),
    );
    const relative = path.relative(repositoryRoot, absolute);
    if (absolute.endsWith(".spec.ts"))
      throw new Error(
        "Browser spec argument " +
          argument +
          "; use npm run test:browser -- " +
          argument,
      );
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    )
      throw new Error(
        "Test file argument is outside the repository: " + argument,
      );
    let metadata;
    try {
      metadata = await fs.stat(absolute);
    } catch (cause) {
      throw new Error("Cannot read test file argument: " + argument, { cause });
    }
    if (!metadata.isFile())
      throw new Error("Test file argument is not a file: " + argument);
    const file = relative.split(path.sep).join("/");
    if (!seen.has(file)) {
      files.push({ argument, file });
      seen.add(file);
    }
  }
  return { files, patterns, selected: files.length > 0 || patterns.length > 0 };
}

/** Validate inventory membership and choose normalized files for execution. */
export function selectUnitFiles(selection, inventory) {
  if (inventory.length === 0) throw new Error("unit test discovery was empty");
  const discovered = new Set(inventory);
  for (const { argument, file } of selection.files)
    if (!discovered.has(file))
      throw new Error(
        "Test file argument is outside the unit inventory: " + argument,
      );
  return selection.files.length > 0
    ? selection.files.map(({ file }) => file)
    : [...inventory];
}

/** Compile without matching so bad regexes fail before preparation or Node. */
function requirePattern(value) {
  if (!value) throw new Error(usage);
  try {
    const literal = /^\/(.*)\/([a-z]*)$/.exec(value);
    RegExp(literal?.[1] ?? value, literal?.[2] || "");
  } catch (cause) {
    throw new Error(usage, { cause });
  }
  return value;
}

/** npm consumes flags before its separator and exports them as configuration. */
function rejectConsumedNpmFlags(environment) {
  for (const [variable, flag, command] of [
    [
      "npm_config_test_name_pattern",
      "--test-name-pattern",
      "npm test -- --test-name-pattern=<regex>",
    ],
    [
      "npm_config_shard",
      "--shard",
      "npm run test:prepared -- --shard INDEX/TOTAL",
    ],
  ]) {
    if (environment[variable])
      throw new Error(
        "npm consumed " +
          flag +
          ". Put every argument after --; use " +
          command +
          ".",
      );
  }
}
