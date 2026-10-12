/** Build the real preview in a normal Node process, outside Playwright's stack instrumentation. */
import path from "node:path";

import { buildPreview } from "../../scripts/preview/catalogue.mjs";
import { createCommittedExampleBaseline } from "../helpers/example_baseline.js";

const output = process.argv[2];
if (!output) throw new Error("The ordinary preview build needs an output path");
const root = path.dirname(path.dirname(output));
const config = await createCommittedExampleBaseline(root, "ordinary-preview");
await buildPreview(config, output);
