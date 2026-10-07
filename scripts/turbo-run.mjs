import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const env = { ...process.env };
if (!env.TURBO_TOKEN || !env.TURBO_REMOTE_CACHE_SIGNATURE_KEY) {
  delete env.TURBO_TOKEN;
  delete env.TURBO_REMOTE_CACHE_SIGNATURE_KEY;
  env.TURBO_CACHE = "local:rw";
}

const child = spawn(
  process.execPath,
  [require.resolve("turbo/bin/turbo"), "run", ...process.argv.slice(2)],
  { env, stdio: "inherit" },
);
child.on("error", (error) => {
  process.stderr.write(
    `Could not start the installed Turbo binary: ${error.message}\n`,
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
