import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { nativeRoot } from "./native_resolution.js";

const owners = ["static-config-dir", "static-absolute-paths"] as const;

export type DurableFixtureOwner = (typeof owners)[number];

/** Create all shared parents before allocating a scoped child of one private owner. */
export async function durableRoot(
  context: TestContext,
  owner: DurableFixtureOwner,
): Promise<string> {
  const root = path.resolve(
    import.meta.dirname,
    "../../target/durable-capture-fixtures",
  );
  for (const runtime of ["rust", "node"]) {
    await fs.mkdir(path.join(root, runtime), { recursive: true });
  }
  const node = path.join(root, "node");
  for (const owner of owners) {
    await fs.mkdir(path.join(node, owner), { recursive: true });
  }
  return nativeRoot(context, path.join(node, owner));
}
