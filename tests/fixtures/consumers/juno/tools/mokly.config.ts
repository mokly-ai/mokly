import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  roots: [{ dir: "../spec/catalogue" }],
  mockupsDir: "../site/mockups",
  repoRoot: "..",
  review: {
    outDir: "../.context/review",
  },
  stylesheets: [
    { match: "workspace-overview/index.html", stylesheets: ["juno.css"] },
  ],
});
