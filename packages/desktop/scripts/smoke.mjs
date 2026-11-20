import { spawnSync } from "node:child_process";

const playwright = "../../node_modules/.bin/playwright";
const linux = process.platform === "linux";
const result = spawnSync(
  linux ? "xvfb-run" : playwright,
  linux ? ["-a", "-s", "-screen 0 1920x1080x24", playwright, "test"] : ["test"],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
