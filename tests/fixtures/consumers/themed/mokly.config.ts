import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  roots: [{ dir: "catalogue/entries" }],
  mockupsDir: "docs/mockups",
  moduleResolution: {
    aliases: { "react-native": "react-native-web" },
    conditions: ["react-native", "import", "module", "default"],
    loaders: { ".js": "jsx" },
    mainFields: ["react-native", "module", "main"],
    packageRoots: ["."],
    resolveExtensions: [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ".tsx",
      ".ts",
      ".js",
      ".jsx",
      ".json",
    ],
  },
  renderer: "catalogue/renderer.tsx",
  repoRoot: ".",
  review: {
    base: "HEAD",
    outDir: ".context/mokly-review",
  },
  stylesheets: [
    { match: "themed-dashboard/index.html", stylesheets: ["app.css"] },
    { match: "themed-campaign/index.html", stylesheets: ["marketing.css"] },
  ],
  watch: {
    debounceMs: 20,
    rules: [
      { action: "reload", paths: ["external/templates.json"] },
      { action: "rebuild", paths: ["shared/**"] },
    ],
  },
});
