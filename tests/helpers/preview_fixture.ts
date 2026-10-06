import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Exercise the repository preview adapter with a real independent consumer. */
export async function buildPreviewFixture(root: string, output: string) {
  return execute(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'import { loadConfig } from "./packages/mokly/dist/config/load.js"; import { buildPreview } from "./scripts/preview/catalogue.mjs"; await buildPreview(await loadConfig(process.argv[1]), process.argv[2]);',
      root,
      output,
    ],
    { cwd: repositoryRoot, timeout: 60_000 },
  );
}
