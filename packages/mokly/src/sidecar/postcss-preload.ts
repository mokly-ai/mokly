/**
 * The PostCSS worker's `--require` preload. On the main thread it wraps the
 * file, descriptor, sharing and module-load boundaries before any consumer
 * preload runs. Native scanners, memory maps, helper processes, other workers
 * and custom loaders still read unobserved, so evidence stays `incomplete`.
 */
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";

import {
  observeModuleLoads,
  shareReadEvidence,
  trustEarlyReaders,
} from "./postcss-evidence.js";
import { observeModulePaths } from "./postcss-path-hooks.js";
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
  observeModuleLoads();
  observeModulePaths();
  shareReadEvidence();
}
