import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entriesDir: "catalogue/entries",
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
    sharedImpact: ["packages/firna-ui/**", "shared/**"],
  },
  stylesheets: [
    { match: "app/**/*.html", stylesheets: ["app.css"] },
    { match: "marketing/**/*.html", stylesheets: ["marketing.css"] },
  ],
  watch: {
    debounceMs: 20,
    rules: [
      { action: "reload", paths: ["external/templates.json"] },
      { action: "rebuild", paths: ["shared/**"] },
    ],
  },
});
