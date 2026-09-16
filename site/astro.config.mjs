import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

import { codePanel } from "./src/docs/code-panel.ts";
import { referenceDocument } from "./src/docs/reference.ts";
import { settings } from "./src/settings.ts";

export default defineConfig({
  integrations: [mdx(), react()],
  markdown: {
    processor: satteri({ hastPlugins: [codePanel, referenceDocument] }),
    shikiConfig: {
      defaultColor: false,
      themes: {
        dark: "github-dark-high-contrast",
        light: "github-light-high-contrast",
      },
      wrap: true,
    },
  },
  output: "static",
  site: settings.origin,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
});
