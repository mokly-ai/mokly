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
const ignoreInterrupt = () => {};
const forwardTerm = () => {
  if (!child.killed) child.kill("SIGTERM");
};
const forwardHangup = () => {
  if (!child.killed) child.kill("SIGHUP");
};
const cleanup = () => {
  process.off("SIGINT", ignoreInterrupt);
  process.off("SIGTERM", forwardTerm);
  process.off("SIGHUP", forwardHangup);
};
process.on("SIGINT", ignoreInterrupt);
process.on("SIGTERM", forwardTerm);
process.on("SIGHUP", forwardHangup);

child.once("error", (error) => {
  cleanup();
  process.stderr.write(
    `Could not start the installed Turbo binary: ${error.message}\n`,
  );
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  cleanup();
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
