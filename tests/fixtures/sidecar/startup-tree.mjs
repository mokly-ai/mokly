import { spawn } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const descendant = spawn(
  process.execPath,
  ["--eval", "process.stdout.write('ready\\n'); setInterval(() => {}, 60000)"],
  { detached: true, stdio: ["ignore", "pipe", "inherit"] },
);

createInterface({ input: descendant.stdout }).once("line", () => {
  const target = join(process.cwd(), "startup-tree-ready");
  writeFileSync(`${target}.tmp`, `${process.pid} ${descendant.pid}`);
  renameSync(`${target}.tmp`, target);
});

setInterval(() => {}, 60_000);
