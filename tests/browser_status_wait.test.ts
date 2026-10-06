import { execFile } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("design runtime tests wait for selected URLs and final statuses before saving them", async () => {
  await promisify(execFile)(process.execPath, [
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    fileURLToPath(
      new URL("./helpers/browser_status_probe.mjs", import.meta.url),
    ),
  ]);
});
