import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

import { settings } from "./src/settings.ts";

export default defineConfig({
  integrations: [mdx(), react()],
  output: "static",
  site: settings.origin,
  trailingSlash: "always",
  build: { format: "directory" },
});
