import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { savedApiEnvironment } from "./api-environment";
import type { Published } from "./publish";

/** Seed stored legacy bytes that today's upload receiver cannot accept. */
export function legacyPublication(source: Published, version: 3): Published {
  const id = randomUUID();
  const environment = savedApiEnvironment();
  const seeded = spawnSync(
    "python3",
    [
      resolve(process.cwd(), "src/_tests_/legacy-publication.py"),
      environment.MKC_DATABASE_URL,
      environment.MKC_FILE_STORE_ROOT,
      source.id,
      id,
      String(version),
    ],
    { encoding: "utf8" },
  );
  if (seeded.status !== 0) {
    throw new Error(
      `legacy publication failed: ${seeded.stderr.slice(0, 500)}`,
    );
  }
  return {
    id,
    catalogueUrl: source.catalogueUrl?.replace(source.id, id) ?? null,
  };
}
