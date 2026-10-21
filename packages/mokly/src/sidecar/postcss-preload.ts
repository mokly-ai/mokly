import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";

import { observeAsyncModuleLoads } from "./postcss-async-registration.js";
import {
  observeModuleLoads,
  shareReadEvidence,
  trustEarlyReaders,
} from "./postcss-evidence.js";
import { observeDescriptors } from "./postcss-read-descriptors.js";
import { observeFileReads } from "./postcss-read-files.js";
import { observeDescriptorSharing } from "./postcss-read-sharing.js";

const option = `--require=${JSON.stringify(fileURLToPath(import.meta.url))}`;
const inherited = process.env.NODE_OPTIONS;
if (inherited?.startsWith(option)) {
  const remaining = inherited.slice(option.length).trimStart();
  if (remaining) process.env.NODE_OPTIONS = remaining;
  else delete process.env.NODE_OPTIONS;
}
// Worker threads, including Node's async loader, retain opaque coverage.
if (isMainThread) {
  trustEarlyReaders();
  observeFileReads();
  observeDescriptors();
  observeDescriptorSharing();
  observeAsyncModuleLoads();
  observeModuleLoads();
  shareReadEvidence();
}
