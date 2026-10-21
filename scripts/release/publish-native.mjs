import path from "node:path";

import { inspectReleaseSet } from "./package_set.mjs";
import { publishPackages } from "./publication.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const directory = path.resolve(
  root,
  process.argv[2] ?? ".context/release-artifact",
);
const packages = await inspectReleaseSet(root, directory);
await publishPackages(
  root,
  packages.filter(({ report }) => report.name.startsWith("@mokly/native-")),
);
