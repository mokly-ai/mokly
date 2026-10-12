import { execFile } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("design runtime tests await final status after navigation and reset", async () => {
  await promisify(execFile)(process.execPath, [
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    fileURLToPath(
      new URL("./helpers/browser_status_probe.mjs", import.meta.url),
    ),
  ]);
});
