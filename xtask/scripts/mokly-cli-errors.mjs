import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { checkoutSources, encode } from "./mokly-fixture-runtime.mjs";
import {
  failureCode,
  planReceiver,
  testToken,
} from "./mokly-fixture-upload.mjs";

/** Observe public CLI failures in a private checkout and loopback exchange. */
export async function captureCliErrors(root, temporary, runtime, moklyVersion) {
  const checkout = join(temporary, "cli-errors");
  await checkoutSources(
    checkout,
    join(root, "crates/mkc-mokly-contract/fixtures/src"),
    runtime,
  );
  const receiver = await planReceiver(503);
  try {
    const scenarios = [];
    await writeFile(join(checkout, "uncommitted.txt"), "uncommitted fixture\n");
    for (const scenario of ["uncommitted-file", "refused-upload"]) {
      const result = await runtime.publish(
        checkout,
        receiver.endpoint,
        testToken,
        false,
      );
      const code = failureCode(result);
      receiver.verify(scenario === "uncommitted-file" ? 0 : 5);
      assert.equal(result.builds, scenario === "uncommitted-file" ? 0 : 1);
      scenarios.push({ scenario, code, exitCode: result.exitCode });
      await rm(join(checkout, "uncommitted.txt"), { force: true });
    }
    return Buffer.from(encode({ moklyVersion, scenarios }));
  } finally {
    await receiver.close();
  }
}
