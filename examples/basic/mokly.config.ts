import { defineConfig } from "@mokly/mokly";

import {
  designBaseStyles,
  componentLayoutStyles,
  workspaceLayoutStyles,
} from "./entries/design/components/parts/styles.js";
import {
  libraryStyleCandidates,
  withLibraryStyles,
} from "./entries/design/library/style_files.js";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  entries: [
    "examples/basic/entries/**/*.mockup.{ts,tsx}",
    "examples/basic/src/components/**/*.mockup.{ts,tsx}",
  ],
  mockupsDir: ".",
  moduleResolution: {
    aliases: { "react-native": "react-native-web" },
    conditions: ["react-native", "import", "module", "default"],
    loaders: { ".js": "jsx" },
    mainFields: ["react-native", "module", "main"],
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
  renderer: "renderer.tsx",
  repoRoot: "../..",
  review: {
    baselineBuild: [
      ["npm", "ci"],
      ["npm", "run", "build"],
      ["npm", "run", "example:build"],
    ],
    outDir: ".context/basic-review",
    sharedImpact: [
      "examples/basic/src/components/**",
      "examples/basic/design-review.css",
      "examples/basic/design-stage.css",
      "examples/basic/design.css",
      "examples/basic/renderer.tsx",
      "examples/basic/styles.css",
    ],
  },
  stylesheets: [
    {
      match: "design/library/**",
      stylesheets: withLibraryStyles(designBaseStyles, [
        ...componentLayoutStyles,
        "design-component-controls.css",
        "design-library.css",
      ]),
    },
    {
      match: "design/components/controls/**",
      stylesheets: withLibraryStyles(designBaseStyles, [
        ...componentLayoutStyles,
        "design-component-controls.css",
      ]),
    },
    {
      match: "design/components/**",
      stylesheets: withLibraryStyles(designBaseStyles, componentLayoutStyles),
    },
    {
      match: "design/review/**",
      stylesheets: withLibraryStyles(
        ["design.css", "design-stage.css", "design-review.css"],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "design/**",
      stylesheets: withLibraryStyles(
        ["design.css", "design-stage.css"],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "**/*.html",
      stylesheets: ["styles.css", "example-components.css"],
    },
  ],
  watch: {
    rules: [
      {
        action: "reload",
        paths: [
          ...libraryStyleCandidates.map((file) => "examples/basic/" + file),
          "examples/basic/design-library.css",
          "examples/basic/design-components.css",
          "examples/basic/design-component-inspection.css",
          "examples/basic/design-component-details.css",
          "examples/basic/design-component-inspector.css",
          "examples/basic/design-component-controls.css",
          "examples/basic/design-component-workspace.css",
          "examples/basic/design-component-view.css",
          "examples/basic/design-review.css",
          "examples/basic/design-stage.css",
          "examples/basic/design.css",
          "examples/basic/styles.css",
          "examples/basic/example-components.css",
        ],
      },
    ],
  },
});
