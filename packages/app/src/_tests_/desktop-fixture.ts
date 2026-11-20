import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { repositoryRoot } from "./root";

/**
 * The desktop origin as the shared fixture records it. `mkc_domain` is pinned
 * to the same file, so a test that reads it here holds this application to
 * the literal the API admits rather than to a copy of its own.
 */
export const fixtureDesktopOrigin = (
  JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "fixtures/desktop-origin.json"),
      "utf8",
    ),
  ) as { origin: string }
).origin;
