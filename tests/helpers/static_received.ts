import assert from "node:assert/strict";

import { verifyInventory } from "./receiver/ownership.js";
import { files } from "./static_faults.js";

/** Compare the receiver's wire bytes with the installed artifact on every platform. */
export async function verifyReceived(
  received: Map<string, Buffer>,
  output: string,
) {
  const local = new Map(
    [...(await files(output))].map(([name, bytes]) => [
      name.replaceAll("\\", "/"),
      bytes,
    ]),
  );
  assert.deepEqual(received, local);
  verifyInventory([...received]);
}
