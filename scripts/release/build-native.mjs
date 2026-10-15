import path from "node:path";

import { packNative } from "./native.mjs";

const [target, destination = ".context/release-artifact", binary] =
  process.argv.slice(2);
if (!target || process.argv.length > 5)
  throw new Error("usage: build-native.mjs {target} [destination] [binary]");
const root = path.resolve(import.meta.dirname, "../..");
const packed = await packNative(
  root,
  target,
  path.resolve(root, destination),
  binary && path.resolve(binary),
);
process.stdout.write(
  `Prepared ${packed.archivePath} (${packed.report.integrity}).\n`,
);
