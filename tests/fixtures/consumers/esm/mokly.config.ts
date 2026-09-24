import { componentStylesheets, defineConfig } from "@mokly/mokly";

export default defineConfig({
  entries: ["entries/**/*.mockup.{ts,tsx}", "src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "mockups",
  repoRoot: ".",
  review: {
    base: "HEAD",
    outDir: ".review",
    sharedImpact: ["notes.md"],
  },
  stylesheets: [
    {
      match: "screens/**/*.html",
      stylesheets: ["fixture.css", componentStylesheets],
    },
    { match: "components/**", stylesheets: [componentStylesheets] },
  ],
});
