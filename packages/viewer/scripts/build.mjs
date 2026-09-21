import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { buildBrowserModules, writeBrowserManifest } from "./browser.mjs";
import { bundleInspector } from "./inspector-bundle.mjs";
import { embeddedStyles } from "./styles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "dist");
await fs.cp(path.join(root, "src/shell/assets"), path.join(target, "assets"), {
  recursive: true,
});
await buildBrowserModules(
  path.join(root, "src/client"),
  path.join(target, "browser"),
  {
    additionalEntries: {
      recovery: path.join(root, "src/standalone/recovery.ts"),
    },
  },
);
await build({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  entryPoints: [path.join(root, "src/browser.tsx")],
  format: "esm",
  logLevel: "silent",
  minify: true,
  outfile: path.join(target, "browser/react-shell.js"),
  platform: "browser",
  target: "es2023",
});
await build({
  bundle: true,
  entryPoints: [path.join(root, "src/standalone/navigation_resize.ts")],
  format: "iife",
  logLevel: "silent",
  outfile: path.join(target, "browser/navigation-resize.js"),
  platform: "browser",
  target: "es2023",
});
await bundleInspector(
  path.join(root, "src/inspector/index.ts"),
  path.join(target, "browser/inspector.js"),
);
await writeBrowserManifest(path.join(target, "browser"));
const { SHELL_CSS } = await import("../dist/shell/css.js");
const { VIEWER_CSS } = await import("../dist/viewer/styles.js");
await fs.writeFile(
  path.join(target, "styles.css"),
  embeddedStyles(SHELL_CSS, VIEWER_CSS),
);
