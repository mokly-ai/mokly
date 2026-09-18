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
  entriesDir: "entries",
  mockupsDir: "generated",
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
      "examples/basic/generated/design-review.css",
      "examples/basic/generated/design-stage.css",
      "examples/basic/generated/design.css",
      "examples/basic/renderer.tsx",
      "examples/basic/generated/styles.css",
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
      match: "design/browse/appearance/**",
      stylesheets: withLibraryStyles(
        ["design.css", "design-stage.css", "design-review.css"],
        workspaceLayoutStyles,
      ),
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
          ...libraryStyleCandidates.map(
            (file) => "examples/basic/generated/" + file,
          ),
          "examples/basic/generated/design-library.css",
          "examples/basic/generated/design-components.css",
          "examples/basic/generated/design-component-inspection.css",
          "examples/basic/generated/design-component-details.css",
          "examples/basic/generated/design-component-inspector.css",
          "examples/basic/generated/design-component-controls.css",
          "examples/basic/generated/design-component-workspace.css",
          "examples/basic/generated/design-component-view.css",
          "examples/basic/generated/design-review.css",
          "examples/basic/generated/design-stage.css",
          "examples/basic/generated/design.css",
          "examples/basic/generated/styles.css",
          "examples/basic/generated/example-components.css",
        ],
      },
    ],
  },
});
