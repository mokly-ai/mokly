import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { writeBrowserManifest } from "./browser.mjs";
import { bundleInspector } from "./inspector-bundle.mjs";
import { embeddedStyles } from "./styles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "dist");
const browser = path.join(target, "browser");
// The component rules of the installed `@mokly/ui`, which both stylesheets
// carry, so that a delivery or a host loads one stylesheet.
const componentCss = await fs.readFile(
  fileURLToPath(import.meta.resolve("@mokly/ui/styles.css")),
  "utf8",
);
await fs.cp(path.join(root, "src/shell/assets"), path.join(target, "assets"), {
  recursive: true,
});
await fs.rm(browser, { force: true, recursive: true });
await fs.mkdir(browser, { recursive: true });
// The standalone shell that Serve and `build` deliver as
// `mokly-viewer/client/shell.js`, with React and React DOM bundled in.
await build({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  entryPoints: [path.join(root, "src/browser.tsx")],
  format: "esm",
  logLevel: "silent",
  minify: true,
  outfile: path.join(browser, "shell.js"),
  platform: "browser",
  target: "es2023",
});
await bundleInspector(
  path.join(root, "src/inspector/index.ts"),
  path.join(browser, "inspector.js"),
);
await writeBrowserManifest(browser);
const { shellCss, standaloneShellCss } = await import("../dist/shell/css.js");
const { VIEWER_CSS } = await import("../dist/viewer/styles.js");
// The standalone stylesheet that Serve and `build` deliver as
// `mokly-viewer/shell.css`, and the scoped stylesheet of an embedded root.
await fs.writeFile(
  path.join(target, "shell.css"),
  standaloneShellCss(componentCss),
);
await fs.writeFile(
  path.join(target, "styles.css"),
  embeddedStyles(shellCss(componentCss), VIEWER_CSS),
);
