import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import { legalSchema } from "./legal.js";

/** Terms and Privacy, rendered in the site's readable document column. */
const legal = defineCollection({
  loader: glob({ base: "./src/content/legal", pattern: "*.md" }),
  schema: legalSchema,
});

export const collections = { legal };
