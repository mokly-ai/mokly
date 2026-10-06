#!/usr/bin/env node

import { bootstrapCli } from "./bootstrap.js";

await bootstrapCli({
  load: async () => {
    await import("./main.js");
  },
  nodeVersion: process.versions.node,
  reportUnsupported: (message) => {
    process.stderr.write(`[mokly/cli-invalid] ${message}\n`);
    process.exitCode = 1;
  },
});
