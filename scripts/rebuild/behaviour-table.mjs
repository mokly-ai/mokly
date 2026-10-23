/** Reduce captured outputs to a format-independent, sorted behaviour table. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adaptLegacyScenario } from "./legacy-adapter.mjs";
import { adaptRustScenario } from "./rust-adapter.mjs";

/** Sort sets and object keys without retaining deployment or source-format ids. */
export function behaviourTable(scenario, adapter) {
  return canonical({ schemaVersion: 2, ...adapter(scenario) });
}

function canonical(value) {
  if (Array.isArray(value)) {
    const records = value.map(canonical);
    return [
      ...new Map(records.map((record) => [JSON.stringify(record), record])),
    ]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, record]) => record);
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

async function readOptional(directory, name) {
  try {
    return JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** Read a capture, including partial captures, without reading generated trees. */
export async function readScenario(directory) {
  const [catalogue, review, inventory, closures] = await Promise.all([
    readOptional(directory, "catalogue.json"),
    readOptional(directory, "review.json"),
    readOptional(directory, "export-inventory.json"),
    readOptional(directory, "resource-closures.json"),
  ]);
  return { catalogue, review, inventory, closures };
}

/** Read the Rust capture and its separately stored entry-detail records. */
export async function readRustScenario(directory) {
  return {
    ...(await readScenario(directory)),
    details: await readOptional(directory, "entry-details.json"),
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const arguments_ = process.argv.slice(2);
  const adapter =
    arguments_.find((value) => value.startsWith("--adapter="))?.slice(10) ??
    "legacy";
  if (!["legacy", "rust"].includes(adapter))
    throw new Error(`Unknown adapter: ${adapter}`);
  const [directory, destination] = arguments_.filter(
    (value) => !value.startsWith("--adapter="),
  );
  if (!directory)
    throw new Error(
      "Usage: behaviour-table.mjs SCENARIO [OUTPUT] [--adapter=legacy|rust]",
    );
  const table = behaviourTable(
    await (adapter === "rust"
      ? readRustScenario(directory)
      : readScenario(directory)),
    adapter === "rust" ? adaptRustScenario : adaptLegacyScenario,
  );
  await fs.writeFile(
    destination ?? path.join(directory, "behaviour-table.json"),
    `${JSON.stringify(table, null, 2)}\n`,
  );
}
