import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

/** Recognize nonzero skip and todo counts in the supported suite runners. */
export function skippedReason(text) {
  const clean = stripVTControlCharacters(text);
  if (/^\s*SKIP(?:\s|:)/m.test(clean)) return "a check reported SKIP";
  if (/(?:^|\n)\s*(?:#|ℹ)\s*(?:skipped|todo)\s+[1-9]\d*\b/.test(clean))
    return "Node reported skipped or todo tests";
  if (/[1-9]\d* ignored;/.test(clean)) return "Rust reported ignored tests";
  if (/\b[1-9]\d* (?:skipped|pending|todo)\b|\bskipped=[1-9]\d*\b/.test(clean))
    return "tests reported skips";
  return null;
}

/** Stream one child command and reject a successful run with skipped checks. */
export async function runStrict(program, args) {
  if (!program) throw new Error("Expected a command");
  const executable =
    process.platform === "win32" && program === "npm" ? "npm.cmd" : program;
  const child = spawn(executable, args, { stdio: ["inherit", "pipe", "pipe"] });
  let reason = null;
  for (const [stream, output] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let tail = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output.write(chunk);
      const lines = (tail + chunk).split("\n");
      tail = lines.pop();
      reason ??= skippedReason(lines.join("\n"));
    });
    stream.on("end", () => {
      reason ??= skippedReason(tail);
    });
  }
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) =>
      resolve(signal ? 1 : (status ?? 1)),
    );
  });
  if (code === 0 && reason) {
    process.stderr.write(
      `[xtask/strict] ${reason}; skipped checks fail the suite.\n`,
    );
    return 1;
  }
  return code;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runStrict(process.argv[2], process.argv.slice(3));
}
