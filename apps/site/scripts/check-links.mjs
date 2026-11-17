import { fileURLToPath } from "node:url";

import { settings } from "../src/settings.ts";

import { checkLinks } from "./links/check.ts";
import { checkSearch } from "./links/search.ts";

try {
  const root =
    process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
  const count = await checkLinks(root, settings.origin);
  const indexed = await checkSearch(root);
  process.stdout.write(
    `site:links passed (${count} references inspected, ${indexed} documentation pages indexed).\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
