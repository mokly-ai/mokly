import { readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { assertRootDocumentPaths } from "./document-paths.mjs";
import { assertViewerRuntime } from "./viewer-runtime.mjs";

/**
 * Prove that the exported web build carries the pinned viewer: the public and
 * exported viewer stylesheet and font bytes equal the installed release, the
 * document links the stylesheet exactly once, and the JavaScript bundle
 * contains the published viewer runtime.
 */
const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(here, "../public");
const buildRoot = resolve(here, "../dist");
const viewerStyles = fileURLToPath(
  import.meta.resolve("@mokly/viewer/styles.css"),
);
const viewerSource = dirname(viewerStyles);
// The installed release names itself, so a failure says which bytes it was
// measured against rather than a version this script once pinned, and a stale
// install cannot pass for the exact version the app depends on.
const viewerRelease = JSON.parse(
  await readFile(resolve(viewerSource, "../package.json"), "utf8"),
);
const viewerLabel = `${viewerRelease.name}@${viewerRelease.version}`;
const appPackage = JSON.parse(
  await readFile(resolve(here, "../package.json"), "utf8"),
);
const pinned = appPackage.dependencies?.[viewerRelease.name];
if (pinned !== viewerRelease.version) {
  throw new Error(`${viewerLabel} is installed but the app pins ${pinned}`);
}

function inside(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot.length > 0 && !pathFromRoot.startsWith(".." + sep);
}

async function equalBytes(expectedPath, actualPath, label) {
  const [expected, actual] = await Promise.all([
    readFile(expectedPath),
    readFile(actualPath),
  ]);
  if (!expected.equals(actual)) {
    throw new Error(`${label} differs from ${viewerLabel}`);
  }
}

const css = await readFile(viewerStyles, "utf8");
const assets = new Set(
  [...css.matchAll(/url\(["']?(\.\/[^)"']+)/g)].map((match) => match[1]),
);
const delivered = [publicRoot, buildRoot];
for (const root of delivered) {
  await equalBytes(
    viewerStyles,
    resolve(root, "mokly-viewer/styles.css"),
    `${relative(here, root)} viewer stylesheet`,
  );
  for (const asset of assets) {
    const source = resolve(viewerSource, asset);
    if (!inside(viewerSource, source)) {
      throw new Error(`viewer stylesheet asset escapes its package: ${asset}`);
    }
    await equalBytes(
      source,
      resolve(root, "mokly-viewer", asset),
      `${relative(here, root)} ${asset}`,
    );
  }
}

const html = await readFile(resolve(buildRoot, "index.html"), "utf8");
const localAssets = assertRootDocumentPaths(html);

const viewerHref = "/mokly-viewer/styles.css";
const stylesheetLinks = localAssets.filter((asset) => asset === viewerHref);
if (stylesheetLinks.length !== 1) {
  throw new Error("the web build must link the viewer stylesheet exactly once");
}

const entry = /<script src="([^"]+\.js)" defer><\/script>/.exec(html)?.[1];
if (!entry?.startsWith("/")) {
  throw new Error("the web build has no root-relative JavaScript entry");
}
const bundle = await readFile(resolve(buildRoot, entry.slice(1)), "utf8");
assertViewerRuntime(bundle);

process.stdout.write(
  `verified ${viewerLabel} bundle, stylesheet and ${assets.size} stylesheet asset(s)\n`,
);
