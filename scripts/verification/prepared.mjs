import fs from "node:fs/promises";
import path from "node:path";

import { EXAMPLE_SNAPSHOT_PATH } from "./example-snapshot-key.mjs";

const outputs = {
  package: ["dist/cli/bin.js", "packages/viewer/dist/browser/inspector.js"],
  example: ["examples/basic/mokly-generated/mokly-manifest.json"],
  snapshot: [EXAMPLE_SNAPSHOT_PATH],
};

const kinds = {
  all: {
    names: [...outputs.package, ...outputs.example],
    preparation: "verification",
  },
  package: { names: outputs.package, preparation: "verification" },
  example: { names: outputs.example, preparation: "verification" },
  unit: {
    names: [...outputs.package, ...outputs.example, ...outputs.snapshot],
    preparation: "unit",
  },
};

/** Fail before a prepared runner starts when its preparation output is missing. */
export async function requirePrepared(repositoryRoot, kind = "all") {
  const selected = Object.hasOwn(kinds, kind) ? kinds[kind] : undefined;
  if (!selected) throw new Error(`unknown prepared output kind ${kind}`);
  const missing = [];
  for (const name of selected.names) {
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
      `prepared verification output is missing: ${missing.join(", ")}; run npm run prepare:${selected.preparation} first`,
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
