import { satteri } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

import { codePanel } from "./src/docs/code-panel.ts";
import { guideDocument } from "./src/docs/guides.ts";
import { referenceDocument } from "./src/docs/reference.ts";
import { settings } from "./src/settings.ts";

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";

export default defineConfig({
  integrations: [react()],
  markdown: {
    processor: satteri({
      hastPlugins: [codePanel, guideDocument, referenceDocument],
    }),
    // The high-contrast GitHub themes keep highlighted tokens at 4.5:1 against
    // the code panel surface in each scheme, as docs/protocol/cloud/site-docs.md
    // requires of every fence the guides use.
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
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Security-Policy": contentSecurityPolicy,
    },
  },
  site: settings.origin,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
});
