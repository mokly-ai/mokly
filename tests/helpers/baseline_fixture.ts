import path from "node:path";

import { Header } from "tar";

import type {
  BaselineMaintenanceFailure,
  BaselineMaintenanceReporter,
} from "../../dist/baseline/maintenance.js";
import { CachedBaselineBuilder } from "../../dist/baseline/rebuild.js";
import type {
  BaselineBuildRequest,
  BaselineClock,
  BaselineProcessRequest,
  BaselineProcessResult,
  BaselineProcessRunner,
} from "../../dist/baseline/types.js";
import { gitBlobHash } from "../../dist/registry/blob_hash.js";

import { MemoryBaselineFileSystem } from "./baseline_memory.js";

export const baselineCommit = "a".repeat(40);
export const baselineManifest = {
  schemaVersion: 10 as const,
  folders: [],
  generatedBy: "mokly",
  entries: [
    {
      kind: "page",
      path: "page",
      title: "Page",
      description: "Baseline page",
      relatedDocs: [],
      sourcePath: "catalogue.txt",
    },
  ],
  sourceFiles: ["catalogue.txt"],
  assetClosure: [],
  blobHashAlgorithm: "sha1",
  generatedFiles: [
    {
      path: "page/index.html",
      blobHash: gitBlobHash(Buffer.from("<html>Baseline</html>"), "sha1"),
    },
  ],
};
export const success: BaselineProcessResult = {
  exitCode: 0,
  signal: null,
  output: "",
  stdout: Buffer.alloc(0),
};

export function archive(
  entries: readonly {
    path: string;
    type?: "File" | "Directory" | "SymbolicLink" | "Link" | "FIFO";
    linkpath?: string;
    content?: string;
  }[],
): Buffer {
  return Buffer.concat([
    ...entries.flatMap((entry) => {
      const data = Buffer.from(entry.content ?? "");
      const header = new Header({
        path: entry.path,
        type: entry.type ?? "File",
        mode: 0o755,
        size: data.length,
        ...(entry.linkpath ? { linkpath: entry.linkpath } : {}),
      });
      const block = Buffer.alloc(512);
      header.encode(block);
      return [block, data, Buffer.alloc((512 - (data.length % 512)) % 512)];
    }),
    Buffer.alloc(1024),
  ]);
}

export class FakeBaselineClock implements BaselineClock {
  time = Date.parse("2026-09-14T00:00:00.000Z");
  onSleep: (() => void) | undefined;
  now(): number {
    return this.time;
  }
  async sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this.time += milliseconds;
    this.onSleep?.();
    await Promise.resolve();
  }
}

export function baselineFixture() {
  const fs = new MemoryBaselineFileSystem();
  const clock = new FakeBaselineClock();
  const calls: BaselineProcessRequest[] = [];
  const runner: BaselineProcessRunner = {
    pid: 42,
    isAlive: (pid) => pid === 42,
    run: async (request) => {
      calls.push(request);
      if (request.argv[0] === "git")
        return {
          ...success,
          stdout:
            request.argv[1] === "archive"
              ? archive([{ path: "catalogue.txt", content: "base" }])
              : Buffer.alloc(0),
        };
      await fs.mkdir(path.join(request.cwd, "mockups"));
      await fs.mkdir(path.join(request.cwd, "mockups/mokly-generated"));
      await fs.mkdir(path.join(request.cwd, "mockups/mokly-generated/page"));
      await fs.write(
        path.join(request.cwd, "mockups/mokly-generated/mokly-manifest.json"),
        Buffer.from(JSON.stringify(baselineManifest)),
      );
      await fs.write(
        path.join(request.cwd, "mockups/mokly-generated/page/index.html"),
        Buffer.from("<html>Baseline</html>"),
      );
      return success;
    },
  };
  const options = {
    environment: { PATH: "/bin", HOME: "/home/test", SECRET: "hidden" },
    lockTimeoutMs: 10_000,
  };
  const maintenance: BaselineMaintenanceFailure[] = [];
  const reporter: BaselineMaintenanceReporter = {
    report(failure) {
      maintenance.push(failure);
    },
  };
  const builder = new CachedBaselineBuilder(
    fs,
    runner,
    clock,
    reporter,
    options,
  );
  const request: BaselineBuildRequest = {
    repoRoot: "/repo",
    commit: baselineCommit,
    mockupsPath: "mockups",
    commands: [["fixture-build", "$HOME; touch escaped"]],
  };
  return {
    fs,
    clock,
    runner,
    builder,
    request,
    calls,
    options,
    reporter,
    maintenance,
  };
}
