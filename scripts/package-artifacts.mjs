import fs from "node:fs/promises";
import path from "node:path";

import { packPackagePair } from "./package/pair.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--out")
  throw new Error("usage: package-artifacts.mjs --out <.context/directory>");
const destination = path.resolve(repositoryRoot, args[1]);
const contextRoot = path.join(repositoryRoot, ".context");
if (
  destination === contextRoot ||
  (!destination.startsWith(`${contextRoot}${path.sep}`) &&
    destination !== contextRoot)
)
  throw new Error("package artifact output must be inside repository .context");
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
const pair = await packPackagePair(repositoryRoot, destination);
for (const name of ["viewer", "cli"])
  await fs.writeFile(
    path.join(destination, name, "pack-report.json"),
    `${JSON.stringify(pair[name].report, null, 2)}\n`,
  );
