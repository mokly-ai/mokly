import path from "node:path";

import { runRustAudit } from "./rust-audit.mjs";

await runRustAudit({ root: path.resolve(import.meta.dirname, "../..") });
