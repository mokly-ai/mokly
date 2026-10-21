/** Exercise installed release archives from a new consumer outside the repository. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { inspectReleaseSet } from "./package_set.mjs";
import { smokeBrowser } from "./smoke_browser.mjs";
import {
  installConsumer,
  smokeAuthoring,
  smokeBuild,
} from "./smoke_consumer.mjs";
import { smokeServe } from "./smoke_serve.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const directory = path.resolve(process.argv[2] ?? ".context/release-artifact");
const packages = await inspectReleaseSet(repositoryRoot, directory);
const root = await fs.mkdtemp(
  path.join(os.tmpdir(), "mokly-release-consumer-"),
);
try {
  await installConsumer(root, packages);
  await smokeAuthoring(root);
  await smokeBrowser(root, repositoryRoot);
  const version = packages.find(({ report }) => report.name === "@mokly/mokly")
    .report.version;
  const shim = await smokeBuild(root, version);
  await smokeServe(root, shim);
  process.stdout.write(
    "Installed CLI, viewer, native, authoring, Build, and Serve smokes passed.\n",
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
