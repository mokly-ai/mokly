import fs from "node:fs/promises";
import path from "node:path";

import { inspectNativeTls } from "./native_tls.mjs";
import { nativeTarget } from "./targets.mjs";

const [name, destination = ".context/release-artifact"] = process.argv.slice(2);
const target = nativeTarget(name);
const root = path.resolve(import.meta.dirname, "../..");
const output = await inspectNativeTls(
  path.join(root, target.directory, "bin", target.executable),
  target.os,
);
await fs.writeFile(
  path.resolve(
    root,
    destination,
    `native-${target.target}/tls-dependencies.txt`,
  ),
  output,
);
process.stdout.write(output);
