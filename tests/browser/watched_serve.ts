import { spawn } from "node:child_process";
import path from "node:path";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
  type TestFixture,
} from "../helpers/fixture.js";

/** A watched fixture whose process exits before its files are removed. */
export interface WatchedServe {
  fixture: TestFixture;
  url: string;
  stop(): Promise<number | null>;
}

/** Start a real watched consumer and wait until its listening URL is available. */
export async function startWatchedServe(
  entrySource: string,
  options?: { extraConfig?: string },
): Promise<WatchedServe> {
  const fixture = await createFixture(entrySource, options);
  const cli = path.join(repositoryRoot, "dist/cli/bin.js");
  const child = spawn(
    "node",
    [cli, "serve", "--config", fixture.configPath, "--port", "0"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  let stdout = "";
  const appendTail = (previous: string, chunk: Buffer): string =>
    (previous + chunk.toString()).slice(-16_384);
  const output = (): string => `stdout:\n${stdout}\nstderr:\n${stderr}`;
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = appendTail(stderr, chunk);
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("exit", (code) => resolve(code));
    child.once("error", reject);
  });
  let stopped: Promise<number | null> | undefined;
  const stop = (): Promise<number | null> => {
    stopped ??= (async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
      const escalation = setTimeout(() => child.kill("SIGKILL"), 5_000);
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          exited,
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(
              () =>
                reject(new Error("watched serve did not exit after SIGKILL")),
              10_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(escalation);
        if (deadline) clearTimeout(deadline);
        if (child.exitCode !== null || child.signalCode !== null)
          await removeFixture(fixture);
      }
    })();
    return stopped;
  };
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`serve did not start:\n${output()}`)),
        30_000,
      );
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout = appendTail(stdout, chunk);
        const match = stdout.match(/Mokly listening at (http:\/\/[^\s]+)/);
        if (match?.[1]) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      void exited.then(
        (code) => {
          clearTimeout(timer);
          reject(new Error(`serve exited early with ${code}:\n${output()}`));
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
    return { fixture, url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
