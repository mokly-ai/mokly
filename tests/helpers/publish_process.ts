import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);
const cli = path.join(repositoryRoot, "dist/cli/bin.js");

/** Spawn the built publish CLI in the selected deterministic output mode. */
export function runPublishedCli(
  cwd: string,
  endpoint: string,
  token: string,
  options: readonly string[] = [],
  output: "plain" | "rich" = "plain",
) {
  return execute(
    process.execPath,
    [
      cli,
      "publish",
      "--endpoint",
      endpoint,
      "--token",
      token,
      "--repository",
      "github.com/sample/catalogue",
      "--out",
      "site",
      ...options,
    ],
    {
      cwd,
      env: {
        ...process.env,
        MOKLY_OUTPUT: output,
        MOKLY_DIAGNOSTIC: "",
        NO_COLOR: "1",
      },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}
