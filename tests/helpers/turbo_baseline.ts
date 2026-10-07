/** Canonical direct build recipe; baseline reconstruction must stay outside Turbo. */
export const directBaselineCommands = [
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
] as const;
