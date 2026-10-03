import { componentStylesheets, defineConfig } from "@mokly/mokly";

import {
  designBaseStyles,
  componentLayoutStyles,
  workspaceLayoutStyles,
} from "./entries/design/components/parts/styles.js";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  entries: [
    "examples/basic/entries/**/*.mockup.{ts,tsx}",
    "examples/basic/src/components/**/*.mockup.{ts,tsx}",
  ],
  mockupsDir: "generated",
  postcss: "postcss.config.mjs",
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
  },
  stylesheets: [
    {
      match: "components/design-ui-*.html",
      stylesheets: [
        ...designBaseStyles,
        componentStylesheets,
        ...componentLayoutStyles,
        "design-component-controls.css",
        "design-library.css",
      ],
    },
    {
      match: "screens/design-component-controls*.html",
      stylesheets: [
        ...designBaseStyles,
        componentStylesheets,
        ...componentLayoutStyles,
        "design-component-controls.css",
      ],
    },
    {
      match: "screens/design-component-*.html",
      stylesheets: [
        ...designBaseStyles,
        componentStylesheets,
        ...componentLayoutStyles,
      ],
    },
    {
      match: "screens/design-appearance-*.html",
      stylesheets: [
        "design.css",
        "design-stage.css",
        "design-review.css",
        componentStylesheets,
        ...workspaceLayoutStyles,
      ],
    },
    {
      match: "screens/design-changes-*.html",
      stylesheets: [
        "design.css",
        "design-stage.css",
        "design-review.css",
        "design-review-scroll.css",
        componentStylesheets,
        ...workspaceLayoutStyles,
      ],
    },
    {
      match: "screens/design-review-*.html",
      stylesheets: [
        "design.css",
        "design-stage.css",
        "design-review.css",
        componentStylesheets,
        ...workspaceLayoutStyles,
      ],
    },
    {
      match: "screens/design-*.html",
      stylesheets: [
        "design.css",
        "design-stage.css",
        componentStylesheets,
        ...workspaceLayoutStyles,
      ],
    },
    { match: "**/*.html", stylesheets: ["styles.css"] },
  ],
  watch: {
    rules: [
      {
        action: "reload",
        paths: [
          "examples/basic/generated/design-library.css",
          "examples/basic/generated/design-components.css",
          "examples/basic/generated/design-component-inspection.css",
          "examples/basic/generated/design-component-details.css",
          "examples/basic/generated/design-component-inspector.css",
          "examples/basic/generated/design-component-controls.css",
          "examples/basic/generated/design-component-workspace.css",
          "examples/basic/generated/design-component-view.css",
          "examples/basic/generated/design-review.css",
          "examples/basic/generated/design-review-scroll.css",
          "examples/basic/generated/design-stage.css",
          "examples/basic/generated/design.css",
          "examples/basic/generated/styles.css",
          "examples/basic/generated/example-components.css",
        ],
      },
    ],
  },
});
