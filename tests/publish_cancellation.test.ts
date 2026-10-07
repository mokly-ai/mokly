import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { waitUntil } from "./helpers/wait_until.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");
const token = "cancel-receiver-token";

test("SIGINT during Blob upload has dedicated plain and rich output", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  for (const mode of ["plain", "rich"] as const) {
    const receiver = await startFakeReceiver(context, { token });
    receiver.control.blobDelayMs = 1_000;
    const child = spawn(
      process.execPath,
      [
        cli,
        "publish",
        "--endpoint",
        receiver.endpoint,
        "--token",
        token,
        "--repository",
        "github.com/sample/catalogue",
        "--out",
        "site",
        "--no-changes",
      ],
      {
        cwd: fixture.root,
        env: {
          ...process.env,
          MOKLY_DIAGNOSTIC: "",
          MOKLY_OUTPUT: mode,
          NO_COLOR: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    const closed = new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code, signal) => resolve({ code, signal }));
      },
    );
    await waitForBlob(receiver.requests, closed);
    assert.equal(child.kill("SIGINT"), true);
    assert.deepEqual(await closed, { code: 1, signal: null });
    if (mode === "plain") {
      assert.equal(stdout, "");
      assert.equal(
        stderr,
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n",
      );
    } else {
      assert.match(stdout, /Uploading catalogue/u);
      assert.equal(
        stderr,
        "  ✖ Publication was cancelled.  [mokly/upload-failed]\n" +
          "    Run mokly publish again when you are ready.\n",
      );
      assert.doesNotMatch(stderr, /endpoint|connection/iu);
    }
    assert.equal((stdout + stderr).includes(token), false);
  }
});

async function waitForBlob(
  requests: ReadonlyArray<{ kind: string }>,
  closed: Promise<unknown>,
): Promise<void> {
  let exited = false;
  void closed.then(() => {
    exited = true;
  });
  await waitUntil(
    () => {
      if (requests.some(({ kind }) => kind === "blob")) return true;
      if (exited) assert.fail("publish exited before its first Blob request");
      return false;
    },
    {
      timeoutMs: 20_000,
      intervalMs: 10,
      message: "publish did not start a Blob request",
    },
  );
}
