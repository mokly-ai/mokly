import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entriesDir: "../spec/catalogue",
  mockupsDir: "../site/mockups",
  repoRoot: "..",
  review: {
    outDir: "../.context/review",
  },
  stylesheets: [{ match: "workspace/**/*.html", stylesheets: ["juno.css"] }],
});
