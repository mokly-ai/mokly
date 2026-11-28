import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { writeBrowserManifest } from "./browser.mjs";
import { embeddedStyles, standaloneStyles } from "./styles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "dist");
const browser = path.join(target, "browser");
const assets = path.join(root, "src/shell/assets");
// Every rule of the installed `@mokly/ui`, which both stylesheets carry, so
// that a delivery or a host loads one stylesheet, and the rules of the shell
// fonts, which the viewer delivers beside the faces.
const packageCss = await fs.readFile(
  fileURLToPath(import.meta.resolve("@mokly/ui/styles.css")),
  "utf8",
);
const font = await fs.readFile(path.join(assets, "fonts/geist.css"), "utf8");
// The font rules go into the stylesheets, not beside the delivered faces.
await fs.cp(assets, path.join(target, "assets"), {
  filter: (source) => !source.endsWith(".css"),
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
const frameBrowser = path.join(
  path.dirname(fileURLToPath(import.meta.resolve("@mokly/frame"))),
  "browser",
);
for (const asset of ["frame-probe.js", "access-start.html", "access-worker.js"])
  await fs.copyFile(path.join(frameBrowser, asset), path.join(browser, asset));
await writeBrowserManifest(browser);
// The standalone stylesheet that Serve and `build` deliver as
// `mokly-viewer/shell.css`, and the stylesheet of an embedded root. The
// standalone one also carries the rules of the embedded root, and no element
// of the standalone shell matches them.
await fs.writeFile(
  path.join(target, "shell.css"),
  standaloneStyles(font, packageCss),
);
await fs.writeFile(
  path.join(target, "styles.css"),
  embeddedStyles(font, packageCss),
);
