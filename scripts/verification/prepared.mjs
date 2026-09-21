import fs from "node:fs/promises";
import path from "node:path";

const outputs = {
  package: ["dist/cli/bin.js", "packages/viewer/dist/browser/inspector.js"],
  example: ["examples/basic/generated/mokly-manifest.json"],
};

export async function requirePrepared(repositoryRoot, kind = "all") {
  const names =
    kind === "all" ? [...outputs.package, ...outputs.example] : outputs[kind];
  if (!names) throw new Error(`unknown prepared output kind ${kind}`);
  const missing = [];
  for (const name of names) {
    try {
      const stat = await fs.stat(path.join(repositoryRoot, name));
      if (!stat.isFile()) missing.push(name);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing.push(name);
    }
  }
  if (missing.length > 0)
    throw new Error(
      `prepared verification output is missing: ${missing.join(", ")}; run npm run prepare:verification first`,
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const kind = process.argv[2] ?? "all";
  await requirePrepared(repositoryRoot, kind);
}
