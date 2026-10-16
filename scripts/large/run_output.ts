import fs from "node:fs/promises";
import path from "node:path";

import { stop } from "./process.js";
import type { Running } from "./process.js";

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
    await fs.writeFile(
      path.join(root, `.context/${name}-timings.json`),
      JSON.stringify(running.timings),
    );
  } finally {
    await stop(running);
  }
}
