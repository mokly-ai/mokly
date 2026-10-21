import fs from "node:fs/promises";
import path from "node:path";

import { stop } from "./process.js";
import type { Running } from "./process.js";
import type { TimingRecord } from "./timings.js";

/** Write a JSON array without creating one string for the complete record set. */
export async function writeJsonArray<T>(file: string, values: readonly T[]) {
  const handle = await fs.open(file, "w");
  try {
    await handle.writeFile("[");
    for (let offset = 0; offset < values.length; offset += 1024) {
      const encoded = JSON.stringify(values.slice(offset, offset + 1024));
      await handle.writeFile(
        `${offset === 0 ? "" : ","}${encoded.slice(1, -1)}`,
      );
    }
    await handle.writeFile("]");
  } finally {
    await handle.close();
  }
}

/** Persist diagnostics and always release the owned child, even if a write fails. */
export async function finishRun(root: string, name: string, running: Running) {
  try {
    const memory = await running.finishMemory();
    await fs.writeFile(
      path.join(root, `.context/${name}-memory.json`),
      JSON.stringify(memory),
    );
    await fs.writeFile(
      path.join(root, `.context/${name}.log`),
      running.output(),
    );
    await writeJsonArray(
      path.join(root, `.context/${name}-timings.json`),
      running.timings as readonly TimingRecord[],
    );
  } finally {
    await stop(running);
  }
}
