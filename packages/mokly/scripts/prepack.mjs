import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// npm supplies its CLI path on all supported operating systems.
for (const workspace of ["@mokly/viewer", "@mokly/mokly"]) {
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
