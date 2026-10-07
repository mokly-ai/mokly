import { defineConfig } from "@mokly/mokly";

import {
  designBaseStyles,
  componentLayoutStyles,
  workspaceLayoutStyles,
} from "./specs/design/components/parts/styles.js";
import {
  libraryStyleCandidates,
  withLibraryStyles,
} from "./specs/design/library/style_files.js";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  roots: [
    { dir: "specs" },
    { dir: "src/components", path: "example/components" },
  ],
  mockupsDir: ".",
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
      ["npm", "run", "--silent", "build", "--workspace", "@mokly/viewer"],
      [
        "node",
        "node_modules/typescript/bin/tsc",
        "--project",
        "tsconfig.build.json",
      ],
      ["node", "scripts/copy-assets.mjs"],
      [
        "node",
        "dist/cli/bin.js",
        "build",
        "--config",
        "examples/basic/mokly.config.ts",
      ],
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
      match: "design/library/**/index*.html",
      stylesheets: withLibraryStyles(designBaseStyles, [
        ...componentLayoutStyles,
        "design-component-controls.css",
        "design-library.css",
      ]),
    },
    {
      match: "design/components/controls/**/index*.html",
      stylesheets: withLibraryStyles(designBaseStyles, [
        ...componentLayoutStyles,
        "design-component-controls.css",
      ]),
    },
    {
      match: "design/components/**/index*.html",
      stylesheets: withLibraryStyles(designBaseStyles, componentLayoutStyles),
    },
    {
      match:
        "design/browse/appearance/states/light-only-{current,document}/index*.html",
      stylesheets: withLibraryStyles(
        [
          "design.css",
          "design-stage.css",
          "design-documents.css",
          "design-review.css",
        ],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "design/browse/appearance/**/index*.html",
      stylesheets: withLibraryStyles(
        ["design.css", "design-stage.css", "design-review.css"],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "design/changes/diff-controls/**/index*.html",
      stylesheets: withLibraryStyles(
        [
          "design.css",
          "design-stage.css",
          "design-documents.css",
          "design-review.css",
          "design-review-scroll.css",
        ],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "design/changes/**/index*.html",
      stylesheets: withLibraryStyles(
        [
          "design.css",
          "design-stage.css",
          "design-documents.css",
          "design-review.css",
          "design-review-scroll.css",
        ],
        workspaceLayoutStyles,
      ),
    },
    {
      match: "design/**/index*.html",
      stylesheets: withLibraryStyles(
        ["design.css", "design-stage.css", "design-documents.css"],
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
          "examples/basic/design-review-scroll.css",
          "examples/basic/design-documents.css",
          "examples/basic/design-stage.css",
          "examples/basic/design.css",
          "examples/basic/styles.css",
          "examples/basic/example-components.css",
        ],
      },
    ],
  },
});
