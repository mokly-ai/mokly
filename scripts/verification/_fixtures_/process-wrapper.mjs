import path from "node:path";

import { runInherited } from "../process.mjs";

const result = await runInherited(
  process.execPath,
  [path.join(import.meta.dirname, "spawn-tree.mjs")],
  { env: process.env },
);
if (result.interrupted || result.signal || result.exitCode !== 0)
  process.exitCode = 1;
