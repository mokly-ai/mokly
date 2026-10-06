import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packages = new Map([
  ["@mokly/mokly", "dist"],
  ["@mokly/viewer", "packages/viewer/dist"],
]);
const args = process.argv.slice(2);
const example = args.length === 1 && args[0] === "--example";
if (
  args.length &&
  !example &&
  (args.length !== 2 || args[0] !== "--package" || !packages.has(args[1]))
)
  throw new Error(
    "Use clean with no arguments, --example, or --package @mokly/mokly|@mokly/viewer",
  );

const outputs = example
  ? []
  : args.length
    ? [packages.get(args[1])]
    : [...packages.values()];
for (const output of outputs)
  await fs.promises.rm(path.join(repositoryRoot, output), {
    force: true,
    recursive: true,
  });

if (example) {
  const generated = path.join(repositoryRoot, "examples/basic/generated");
  let contained = true;
  for (const directory of [
    "examples",
    "examples/basic",
    "examples/basic/generated",
  ]) {
    const stats = await fs.promises
      .lstat(path.join(repositoryRoot, directory))
      .catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    if (!stats?.isDirectory() || stats.isSymbolicLink()) {
      contained = false;
      break;
    }
  }
  if (contained) await cleanExample(generated);
}

async function cleanExample(directory, relative = "") {
  for (const entry of await fs.promises.readdir(directory, {
    withFileTypes: true,
  })) {
    const route = relative ? `${relative}/${entry.name}` : entry.name;
    const file = path.join(directory, entry.name);
    const owned =
      (!entry.isDirectory() && entry.name.endsWith(".html")) ||
      route === "mokly-manifest.json" ||
      route === "example/workspace.svg" ||
      route === "mokly-generated";
    if (owned) await fs.promises.rm(file, { force: true, recursive: true });
    else if (entry.isDirectory()) await cleanExample(file, route);
  }
}
