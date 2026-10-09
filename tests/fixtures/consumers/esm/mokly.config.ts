import { componentStylesheets, defineConfig } from "@mokly/mokly";

export default defineConfig({
  roots: [{ dir: "entries" }, { dir: "src", files: ["**/*.mockup.{ts,tsx}"] }],
  mockupsDir: "mockups",
  repoRoot: ".",
  review: {
    base: "HEAD",
    outDir: ".review",
  },
  stylesheets: [
    {
      match: "**/index.html",
      stylesheets: ["fixture.css", componentStylesheets],
    },
  ],
});
