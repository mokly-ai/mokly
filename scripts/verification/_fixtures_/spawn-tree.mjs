import { spawn } from "node:child_process";
import path from "node:path";

const grandchild = spawn(
  process.execPath,
  [path.join(import.meta.dirname, "persistent-grandchild.mjs")],
  { stdio: "ignore" },
);
if (!grandchild.pid) throw new Error("grandchild did not start");
setInterval(() => {}, 1_000);
