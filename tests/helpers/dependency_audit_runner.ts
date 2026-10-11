import { Buffer } from "node:buffer";

import { npmAuditCommand } from "../../scripts/verification/dependency-audit-command.mjs";
import type {
  AuditCommand,
  AuditCommandResult,
} from "../../scripts/verification/dependency-audit-command.mjs";
import type { AuditSummary } from "../../scripts/verification/dependency-audit.mjs";

import { auditFixture } from "./dependency_audit.js";

/** In-memory audit boundaries; unit tests never run npm, Git, or filesystem IO. */
export function auditHarness(uncovered = false) {
  const { report, lockfile, exception, today } = auditFixture();
  const files = new Map([
    ["package.json", Buffer.from("{}\n")],
    ["package-lock.json", Buffer.from(JSON.stringify(lockfile))],
    [
      "scripts/verification/dependency-audit-exceptions.json",
      Buffer.from(JSON.stringify(uncovered ? [] : [exception])),
    ],
  ]);
  const baseFiles = new Map(files);
  const written = new Map<string, Buffer>();
  const reports = new Map<string, AuditSummary>();
  const output = { notices: [] as string[], errors: [] as string[] };
  const commands: AuditCommand[] = [];
  const events: string[] = [];
  const head: AuditCommandResult = {
    stdout: JSON.stringify(report),
    stderr: "",
    exitCode: 1,
    signal: null,
  };
  const base = { ...head };
  const state = { commit: "base", temporary: 0, disposed: 0, clocks: 0 };
  const dependencies = {
    args: [] as string[],
    command: npmAuditCommand({
      npmExecPath: "/tools/npm-cli.js",
      nodeExecPath: "/tools/node",
      cwd: "/repo",
      platform: "linux",
    }),
    clock: () => {
      state.clocks++;
      return today;
    },
    readFile: async (file: string): Promise<Buffer> => {
      events.push(`head-read:${file}`);
      const value = files.get(file);
      if (!value) throw new Error(`missing ${file}`);
      return Buffer.from(value);
    },
    runCommand: async (command: AuditCommand): Promise<AuditCommandResult> => {
      commands.push(command);
      events.push(command.cwd === "/repo" ? "head-audit" : "base-audit");
      return command.cwd === "/repo" ? head : base;
    },
    writeReport: async (file: string, summary: AuditSummary): Promise<void> => {
      reports.set(file, structuredClone(summary));
    },
    logger: {
      notice: (message: string) => output.notices.push(message),
      error: (message: string) => output.errors.push(message),
    },
    baseline: {
      resolveComparisonCommit: async (): Promise<string> => {
        events.push("resolve-base");
        return state.commit;
      },
      readRevision: async (commit: string, file: string): Promise<Buffer> => {
        events.push(`base-read:${file}`);
        if (commit !== state.commit) throw new Error("wrong comparison commit");
        const value = baseFiles.get(file);
        if (!value) throw new Error(`missing ${file} in Git`);
        return Buffer.from(value);
      },
      makeTemporaryDirectory: async () => {
        state.temporary++;
        return {
          path: "/tmp/audit-fixture",
          writeFile: async (file: string, contents: Buffer): Promise<void> => {
            written.set(file, Buffer.from(contents));
          },
          dispose: async (): Promise<void> => {
            state.disposed++;
            events.push("dispose");
          },
        };
      },
    },
  };
  return {
    dependencies,
    files,
    baseFiles,
    written,
    reports,
    output,
    commands,
    events,
    head,
    base,
    state,
    report,
    lockfile,
    exception,
    today,
  };
}

/** Force a real comparison without changing the dependency lockfile. */
export function changeManifest(files: Map<string, Buffer>): void {
  files.set(
    "package.json",
    Buffer.from('{"scripts":{"harmless":"node --version"}}'),
  );
}
