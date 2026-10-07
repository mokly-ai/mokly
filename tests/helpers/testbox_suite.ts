import { createHash } from "node:crypto";
import path from "node:path";

import type {
  TestboxCommand,
  TestboxDependencies,
  TestboxOutcome,
} from "../../scripts/verification/testbox-suite.mjs";

export const TESTBOX_FINGERPRINT = `sha256:${"a".repeat(64)}`;
export const TESTBOX_ARGUMENTS = [
  "--expect",
  TESTBOX_FINGERPRINT,
  "--suite",
  "unit",
  "--shard",
  "1/4",
];

export function testboxHarness() {
  const lockfile = Buffer.from("lockfile bytes");
  const digest = createHash("sha256").update(lockfile).digest("hex");
  const stamp = path.join(
    "/home/fixture",
    ".mokly-testbox",
    "package-lock.sha256",
  );
  const files = new Map([
    [path.join("/repo", "package-lock.json"), lockfile],
    [stamp, Buffer.from(`${digest}\n`)],
  ]);
  const commands: TestboxCommand[] = [];
  const events: string[] = [];
  const writes: Array<{ file: string; contents: string }> = [];
  const outcomes = new Map<string, TestboxOutcome>();
  const dependencies: TestboxDependencies = {
    cwd: "/repo",
    environment: { HOME: "/home/fixture", PATH: "/tools" },
    readFingerprint: async () => {
      events.push("fingerprint");
      return TESTBOX_FINGERPRINT;
    },
    readFile: async (file) => {
      events.push(`read:${file}`);
      const contents = files.get(file);
      if (contents === undefined)
        throw Object.assign(new Error("missing file"), { code: "ENOENT" });
      return contents;
    },
    writeFile: async (file, contents) => {
      events.push(`write:${file}`);
      writes.push({ file, contents });
    },
    runCommand: async (command) => {
      events.push([command.file, ...command.args].join(" "));
      commands.push(command);
      return (
        outcomes.get([command.file, ...command.args].join(" ")) ?? {
          exitCode: 0,
          signal: null,
          interrupted: null,
          stdout: command.file === "git" ? "false\n" : "",
          stderr: "",
        }
      );
    },
  };
  return {
    dependencies,
    commands,
    events,
    writes,
    outcomes,
    files,
    digest,
    stamp,
  };
}
