import { processTree } from "../process-tree.mjs";
import { runInherited } from "../process.mjs";
import { spawnServe } from "../serve-process.mjs";

const [mode, cwd, shim] = process.argv.slice(2);
if (mode === "wrapper") {
  const result = await runInherited(
    process.execPath,
    [import.meta.filename, "serve", cwd, shim],
    { cwd },
  );
  process.exitCode =
    result.interrupted || result.signal || result.exitCode !== 0 ? 1 : 0;
} else {
  const server = await spawnServe(
    shim,
    ["--no-watch", "--port", "0", "--sidecars", "1"],
    { cwd },
  );
  const url = await server.listening(AbortSignal.timeout(60_000));
  const view = await fetch(
    `${url}/static/mokly-generated/home/index.mobile.html`,
  );
  if (!view.ok) throw new Error("fixture render failed");
  // The caller kills this worker; the outer owner must drain the registered tree.
  process.stdout.write(`${JSON.stringify(processTree(server.child.pid))}\n`);
}
