import fs from "node:fs/promises";

const pidFile = process.env.MOKLY_TREE_PID_FILE;
if (!pidFile) throw new Error("MOKLY_TREE_PID_FILE is required");
process.on("SIGTERM", () => {});
await fs.writeFile(pidFile, String(process.pid));
setInterval(() => {}, 1_000);
