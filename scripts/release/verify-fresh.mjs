import path from "node:path";

import { requireUnpublishedRelease } from "./fresh.mjs";

await requireUnpublishedRelease(path.resolve(import.meta.dirname, "../.."));
