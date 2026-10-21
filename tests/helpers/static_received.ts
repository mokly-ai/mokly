import assert from "node:assert/strict";

import { verifyInventory } from "./receiver/ownership.js";
import type { exchange } from "./static_exchange.js";
import { files } from "./static_faults.js";
import type { command } from "./static_publication.js";

/** Check installed bytes before Complete permits the client to remove its snapshot. */
export function observeBuild(
  receiver: Awaited<ReturnType<typeof exchange>>,
  running: ReturnType<typeof command>,
): ReturnType<typeof command> {
  receiver.beforeComplete(async (received) => {
    await verifyReceived(received, await running.buildDirectory);
  });
  return running;
}

/** Compare the receiver's wire bytes with the installed artifact on every platform. */
async function verifyReceived(received: Map<string, Buffer>, output: string) {
  const local = new Map(
    [...(await files(output))].map(([name, bytes]) => [
      name.replaceAll("\\", "/"),
      bytes,
    ]),
  );
  assert.deepEqual(received, local);
  verifyInventory([...received]);
}
