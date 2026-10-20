import path from "node:path";

import { requireUnpublishedRelease } from "./fresh.mjs";

await requireUnpublishedRelease(
  path.resolve(import.meta.dirname, "../.."),
  undefined,
  {
    reuseViewer: process.env.VIEWER_REF === "",
  },
);
