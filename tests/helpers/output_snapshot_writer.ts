/** A separate process that pauses a real locked transaction after output pruning. */
import fs from "node:fs/promises";
import path from "node:path";

import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";

const root = process.argv[2]!;
const input = JSON.parse(
  await fs.readFile(path.join(root, "writer-input.json"), "utf8"),
) as {
  manifest: Compilation["manifest"];
  outputs: [string, string][];
  deliveredStyleSources: string[];
}[];
const compilations = input.map((value) => ({
  ...value,
  outputs: new Map(value.outputs),
}));
let resume: (() => void) | undefined;
let shouldPause = false;
const rmdir = fs.rmdir;
fs.rmdir = async (...args: Parameters<typeof fs.rmdir>) => {
  const result = await Reflect.apply(rmdir, fs, args);
  if (
    shouldPause &&
    String(args[0]).startsWith(path.join(root, "mockups") + path.sep)
  ) {
    shouldPause = false;
    const waiting = new Promise<void>((resolve) => {
      resume = resolve;
    });
    process.send?.({ type: "paused" });
    await waiting;
  }
  return result;
};
process.on("message", (message: { type: string; index: number }) => {
  if (message.type === "resume") resume?.();
  if (message.type === "write") {
    shouldPause = true;
    void writeCompilation(compilations[message.index]!, { ...config }).then(
      () => process.send?.({ type: "done" }),
      (error) => process.send?.({ type: "failed", error: String(error) }),
    );
  }
});
const config = await loadConfig(root);
process.send?.({ type: "ready" });
