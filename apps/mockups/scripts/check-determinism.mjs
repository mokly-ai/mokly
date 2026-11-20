/**
 * Prove that the dogfood build matches an independent strict build. The first
 * build is the output in `mokly-static/`, and its snapshot goes under
 * `.context/mockups-determinism/`. The second build runs `mockups:build` in a
 * new process.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { checkBuildDeterminism } from "./determinism.mjs";

const repository = path.resolve(import.meta.dirname, "../../..");
try {
  await checkBuildDeterminism({
    output: path.join(repository, "mokly-static"),
    snapshots: path.join(repository, ".context/mockups-determinism"),
    rebuild: async () => {
      await promisify(execFile)(
        "npm",
        ["run", "mockups:build", "--workspace", "@mokly-cloud/mockups"],
        {
          cwd: repository,
          maxBuffer: 32 * 1024 * 1024,
        },
      );
    },
  });
  process.stdout.write("Independent mockup builds match.\n");
} catch (error) {
  process.stderr.write(
    (error instanceof Error
      ? error.message
      : "Mockup determinism check failed.") + "\n",
  );
  process.exitCode = 1;
}
