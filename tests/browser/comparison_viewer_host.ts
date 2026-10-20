/**
 * An embedded `MoklyViewer` over a copied comparison output, through both
 * frame adapters; the shared output by default, or another copy such as the
 * branch copy. The helper copies the output into its own directory,
 * adds the host page of `comparison_viewer_entry.tsx`, and serves that
 * directory on three origins: the artifact origin, the host origin, and the
 * host origin behind a strict Content Security Policy.
 * `viewer.html?adapter=same-origin` mounts the viewer over the host origin's
 * own copy with `sameOriginAdapter()`; `viewer.html?adapter=cross` mounts it
 * over the artifact origin with `postMessageAdapter({ frameOrigin })`. The
 * source copy's bytes stay unchanged.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expect, type Page } from "@playwright/test";
import { build } from "esbuild";

import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { copiedComparisonDirectory } from "./comparison_test.js";
import { modeButton } from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

/** The origins of one embedded viewer host. */
export interface ComparisonViewerHost {
  /** The host origin; `/viewer.html` mounts the viewer. */
  url: string;
  /** The host origin again, behind a strict Content Security Policy. */
  cspUrl: string;
  /** The artifact origin that the cross adapter frames and fetches. */
  frameOrigin: string;
  close(): Promise<void>;
}

/** Copy `source`, add the host page, and serve it three times. */
export async function comparisonViewerHost(
  source: string = copiedComparisonDirectory(),
): Promise<ComparisonViewerHost> {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "comparison-viewer-",
    ),
  );
  const servers: Awaited<ReturnType<typeof serveStaticFiles>>[] = [];
  const close = async () => {
    for (const server of servers.reverse()) await server.close();
    await fs.rm(root, { recursive: true, force: true });
  };
  try {
    await fs.cp(source, root, { recursive: true });
    await build({
      entryPoints: [
        path.join(repositoryRoot, "tests/browser/comparison_viewer_entry.tsx"),
      ],
      outfile: path.join(root, "viewer.js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2023",
      logLevel: "silent",
    });
    await fs.copyFile(
      path.join(repositoryRoot, "packages/viewer/dist/styles.css"),
      path.join(root, "viewer.css"),
    );
    await fs.cp(
      path.join(repositoryRoot, "packages/viewer/dist/assets"),
      path.join(root, "assets"),
      { recursive: true },
    );
    const artifact = await serveStaticFiles(root);
    servers.push(artifact);
    await fs.writeFile(
      path.join(root, "fixture.js"),
      `window.fixture=${JSON.stringify({ frameOrigin: artifact.url })};`,
    );
    // A same-origin icon keeps the strict policy's img-src free of data URLs.
    await fs.writeFile(path.join(root, "favicon.ico"), "");
    await fs.writeFile(
      path.join(root, "viewer.html"),
      '<!doctype html><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/viewer.css"><body><script src="/fixture.js"></script><script type="module" src="/viewer.js"></script></body>',
    );
    const host = await serveStaticFiles(root);
    servers.push(host);
    const others = (kinds: string[]) =>
      kinds.map((kind) => `${kind} 'self' ${artifact.url}`);
    const cspHost = await serveStaticFiles(root, {
      csp: [
        "default-src 'self'",
        "script-src 'self'",
        `style-src 'self' 'unsafe-inline' ${artifact.url}`,
        ...others(["connect-src", "img-src", "font-src", "media-src"]),
        ...others(["frame-src"]),
        "object-src 'none'",
      ].join("; "),
    });
    servers.push(cspHost);
    artifact.allowOrigin(host.url);
    artifact.allowOrigin(cspHost.url);
    return {
      url: host.url,
      cspUrl: cspHost.url,
      frameOrigin: artifact.url,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Open an entry in the embedded viewer and load a diff mode. */
export async function openEmbeddedComparison(
  page: Page,
  address: string,
  viewport: "desktop" | "mobile",
  mode: "Difference" | "Overlay" | "Side by side",
): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(address);
  await chooseViewport(page, viewport);
  await modeButton(page, mode).click();
  await expect(modeButton(page, mode)).toHaveAttribute("aria-pressed", "true");
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).toHaveCount(2);
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("body")).not.toBeEmpty();
}
