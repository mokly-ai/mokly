import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import { docsSchema } from "./docs/frontmatter.js";
import {
  REFERENCE_DIRECTORY,
  REFERENCE_DOCUMENTS,
  referenceFile,
} from "./docs/reference-allowlist.js";
import { legalSchema } from "./legal.js";

/** Terms and Privacy, rendered in the site's readable document column. */
const legal = defineCollection({
  loader: glob({ base: "./src/content/legal", pattern: "*.md" }),
  schema: legalSchema,
});

/**
 * The documentation, one MDX file per page under its section directory. The
 * schema rejects an unknown section and a page without a title, description
 * or order; `src/docs/pages.ts` rejects a duplicate order or slug and keeps
 * the section tree and this collection describing the same pages.
 */
const docs = defineCollection({
  loader: glob({ base: "./src/content/docs", pattern: "**/*.mdx" }),
  schema: docsSchema,
});

/**
 * The allowlisted protocol documents, read from `docs/protocol` where they
 * live. They are never copied into the site, so the published page and the
 * repository can never drift apart.
 */
const reference = defineCollection({
  loader: glob({
    base: `../${REFERENCE_DIRECTORY}`,
    pattern: REFERENCE_DOCUMENTS.map(referenceFile),
  }),
});

export const collections = { docs, legal, reference };
