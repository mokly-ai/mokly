import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// npm supplies its CLI path on all supported operating systems. The viewer
// build reads the UI package stylesheet, so the UI package builds first.
for (const workspace of ["@mokly/ui", "@mokly/viewer", "@mokly/mokly"]) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "run", "build", "--workspace", workspace],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
