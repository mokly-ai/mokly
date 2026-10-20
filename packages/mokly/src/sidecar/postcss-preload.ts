import { fileURLToPath } from "node:url";

import { observeModuleLoads, trustEarlyReaders } from "./postcss-evidence.js";
import { observeFileReads } from "./postcss-read-files.js";

const option = `--require=${JSON.stringify(fileURLToPath(import.meta.url))}`;
const inherited = process.env.NODE_OPTIONS;
if (inherited?.startsWith(option)) {
  const remaining = inherited.slice(option.length).trimStart();
  if (remaining) process.env.NODE_OPTIONS = remaining;
  else delete process.env.NODE_OPTIONS;
}
trustEarlyReaders();
observeFileReads();
observeModuleLoads();
