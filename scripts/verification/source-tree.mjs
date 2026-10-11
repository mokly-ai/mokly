import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const USAGE =
  "usage: source-tree.mjs [--expect sha256:<digest>] [--print-head]";

/** Require an exact fingerprint without adding a caller's usage line. */
export function validateFingerprint(value) {
  if (typeof value !== "string" || !FINGERPRINT_PATTERN.test(value))
    throw new Error(
      "expected fingerprint must match sha256:<64 lowercase hex digits>",
    );
  return value;
}

/** Decode NUL-delimited Git paths without changing their bytes. */
export function sourcePaths(listing) {
  const bytes = Buffer.from(listing);
  const unique = new Map();
  let start = 0;
  for (let index = 0; index <= bytes.length; index += 1) {
    if (index !== bytes.length && bytes[index] !== 0) continue;
    if (index > start) {
      const name = bytes.subarray(start, index);
      unique.set(name.toString("hex"), name);
    }
    start = index + 1;
  }
  return [...unique.values()].sort(Buffer.compare);
}

/** Hash byte-sorted mode, path and content-digest records with NUL framing. */
export function fingerprintRecords(records) {
  const hash = createHash("sha256");
  const sorted = [...records].sort((first, second) =>
    Buffer.compare(first.path, second.path),
  );
  for (const { mode, path: name, digest } of sorted) {
    hash.update(mode, "ascii");
    hash.update("\0");
    hash.update(name);
    hash.update("\0");
    hash.update(digest, "ascii");
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

/** Read the tracked and non-ignored working tree from its repository root. */
export async function readSourceTree(cwd) {
  const index = sourcePaths(
    await gitOutput(cwd, ["ls-files", "--stage", "-z"]),
  );
  if (
    index.some((entry) => entry.subarray(0, 6).toString("ascii") === "160000")
  )
    throw new Error(
      "source-tree fingerprint does not support submodule entries",
    );
  const names = sourcePaths(
    await gitOutput(cwd, [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ]),
  );
  const root = Buffer.from(`${path.resolve(cwd)}${path.sep}`);
  const records = [];
  for (const name of names) {
    const file = Buffer.concat([root, name]);
    let metadata;
    try {
      metadata = await fs.lstat(file);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    let mode;
    let contents;
    if (metadata.isSymbolicLink()) {
      mode = "120000";
      contents = await fs.readlink(file, { encoding: "buffer" });
    } else if (metadata.isFile()) {
      mode = metadata.mode & 0o111 ? "100755" : "100644";
      contents = await fs.readFile(file);
    } else {
      throw new Error(
        `source-tree fingerprint found an unsupported file type at ${JSON.stringify(name.toString("utf8"))}; ignore or remove a nested repository or worktree`,
      );
    }
    records.push({
      mode,
      path: name,
      digest: createHash("sha256").update(contents).digest("hex"),
    });
  }
  return fingerprintRecords(records);
}

/** Validate every CLI argument before reading Git or files. */
export function parseSourceTreeArguments(args) {
  let expected;
  let printHead = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--print-head" && !printHead) {
      printHead = true;
    } else if (args[index] === "--expect" && expected === undefined) {
      expected = args[++index];
      try {
        expected = validateFingerprint(expected);
      } catch (error) {
        throw new Error(`${error.message}; ${USAGE}`, { cause: error });
      }
    } else {
      throw new Error(USAGE);
    }
  }
  return { ...(expected === undefined ? {} : { expected }), printHead };
}

async function gitOutput(cwd, args) {
  const { stdout } = await execute("git", args, {
    cwd,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function main() {
  const { expected, printHead } = parseSourceTreeArguments(
    process.argv.slice(2),
  );
  const cwd = process.cwd();
  const fingerprint = await readSourceTree(cwd);
  if (expected !== undefined && fingerprint !== expected)
    throw new Error(
      `source-tree fingerprint does not match: expected ${expected}; actual ${fingerprint}`,
    );
  let output = `${fingerprint}\n`;
  if (printHead) {
    const head = (await gitOutput(cwd, ["rev-parse", "HEAD"]))
      .toString("ascii")
      .trim();
    if (!/^[0-9a-f]{40}$/.test(head))
      throw new Error("expected a full lowercase HEAD SHA");
    output += `${head}\n`;
  }
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main().catch((error) => {
    process.stderr.write(`[verification/source-tree] ${error.message}\n`);
    process.exitCode = 1;
  });
