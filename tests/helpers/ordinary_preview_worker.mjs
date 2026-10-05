/** Prepare the real ordinary preview with the standard Node execution context. */
import path from "node:path";

import { buildPreview } from "../../scripts/preview/catalogue.mjs";

import { createCommittedExampleBaseline } from "./example_baseline.js";

const output = process.argv[2];
if (!output) throw new Error("Ordinary preview output is required");
const root = path.dirname(path.dirname(output));
const config = await createCommittedExampleBaseline(root, "ordinary-preview");
await buildPreview(config, output);
