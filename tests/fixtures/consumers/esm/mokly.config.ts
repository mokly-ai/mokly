import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  roots: [{ dir: "entries" }, { dir: "src", files: ["**/*.mockup.{ts,tsx}"] }],
  mockupsDir: "mockups",
  repoRoot: ".",
  review: {
    base: "HEAD",
    outDir: ".review",
    sharedImpact: ["notes.md"],
  },
  stylesheets: [{ match: "**/index.html", stylesheets: ["fixture.css"] }],
});
