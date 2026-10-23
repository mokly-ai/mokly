import { spawn } from "node:child_process";

/** Wait until the parent has durably registered this process group. */
process.once("message", ({ args }) => {
  const child = spawn(process.execPath, args, { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill(signal);
    });
  child.once("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
    if (process.connected) process.disconnect();
  });
});
