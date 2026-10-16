import fs from "node:fs/promises";
import path from "node:path";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type { ComponentViewRecord } from "../src/components/manifest_types.js";

export async function writeBrowserFile(
  root: string,
  name: string,
  bytes: string | Uint8Array,
) {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

export type BrowserUsage = Extract<CatalogueUsage, { status: "ready" }> &
  ComponentViewRecord;
