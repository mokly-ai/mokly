import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packages = new Map([
  ["@mokly/mokly", "dist"],
  ["@mokly/viewer", "packages/viewer/dist"],
]);
const args = process.argv.slice(2);
if (
  args.length &&
  (args.length !== 2 || args[0] !== "--package" || !packages.has(args[1]))
)
  throw new Error(
    "Use clean with no arguments or --package @mokly/mokly|@mokly/viewer",
  );

const outputs = args.length ? [packages.get(args[1])] : [...packages.values()];
for (const output of outputs)
  await fs.promises.rm(path.join(repositoryRoot, output), {
    force: true,
    recursive: true,
  });
