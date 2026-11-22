import fs from "node:fs/promises";
import path from "node:path";

import {
  RUNTIME_INVENTORY,
  writeRuntimeInventory,
} from "./runtime-inventory.mjs";

const directory = process.argv[2];
if (!directory)
  throw new Error("usage: write-runtime-inventory.mjs {output-directory}");
const target = path.resolve(directory);
// npm applies this nested ignore file without changing each package's file list.
await fs.writeFile(path.join(target, ".npmignore"), `${RUNTIME_INVENTORY}\n`);
await writeRuntimeInventory(target);
