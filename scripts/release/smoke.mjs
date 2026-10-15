/** Import the exact viewer archive from an isolated installed consumer. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runCommand } from "./command.mjs";
import { SMOKE_SOURCE } from "./smoke_source.mjs";

const archive = process.argv[2];
if (!archive) throw new Error("Usage: smoke.mjs ARCHIVE");
const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-viewer-smoke-"));
try {
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@mokly/viewer": `file:${path.resolve(archive)}`,
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    }),
  );
  await runCommand(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: root },
  );
  await fs.writeFile(path.join(root, "smoke.mjs"), SMOKE_SOURCE);
  await runCommand(process.execPath, ["smoke.mjs"], { cwd: root });
  process.stdout.write(
    "The installed viewer archive passed its smoke check.\n",
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
