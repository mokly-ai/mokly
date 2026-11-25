/**
 * The download page: the installers that it offers, the address that each
 * Download action opens, and Cal's decision that the page names no version
 * and no release status. The installer names come from their one source in
 * the mockups, the site fixtures.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { desktopInstallers } from "../fixtures/site";

import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  type Element,
} from "./design-site-test-helpers";

/** GitHub's fixed address of a file in the desktop app's latest release. */
const LATEST_RELEASE =
  "https://github.com/mokly-ai/mokly-desktop/releases/latest/download/";

/**
 * Each installer frame in reading order: its system's section box, the
 * computer that its heading names and its file, which the frame's label
 * names and its Download action opens.
 */
const INSTALLERS = [
  ["Mac", "Apple silicon", desktopInstallers.macAppleSilicon],
  ["Mac", "Intel", desktopInstallers.macIntel],
  ["Linux", "AppImage", desktopInstallers.linuxAppImage],
  ["Linux", "Debian and Ubuntu", desktopInstallers.linuxDeb],
] as const;

/** The elements of one tag name under a node, in document order. */
function tags(node: Element, name: string): Element[] {
  return elements(node, (element) => element.tagName === name);
}

/** The one element of a tag name inside a node, failing on none or several. */
function only(node: Element, name: string): Element {
  const found = tags(node, name);
  assert.equal(found.length, 1, `one ${name}`);
  return found[0]!;
}

/** The download document's `main` in one viewport. */
function downloadMain(viewport: "mobile" | "desktop"): Element {
  const { document } = siteDocument("design/site/download", viewport);
  const main = elements(document, (node) => node.tagName === "main")[0];
  assert.ok(main, "download main");
  return main;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: each installer frame names its computer and opens its file in the latest release`, () => {
    const main = downloadMain(viewport);
    assert.deepEqual(
      byClass(main, "site-section-box").flatMap((box) =>
        byClass(box, "site-download-installer").map((frame) => {
          const link = only(frame, "a");
          return [
            label(byClass(box, "site-section-box-tag")[0]!),
            label(only(frame, "h2")),
            label(byClass(frame, "site-frame-name")[0]!),
            attribute(link, "href"),
            label(link),
          ];
        }),
      ),
      INSTALLERS.map(([system, computer, file]) => [
        system,
        computer,
        file,
        LATEST_RELEASE + file,
        `Download for ${system}, ${computer}`,
      ]),
    );
    assert.equal(
      tags(main, "a").length,
      INSTALLERS.length,
      "the Download actions are the only links on the page",
    );
  });

  test(`${viewport}: the download page names no version and no release status`, () => {
    const text = label(downloadMain(viewport));
    assert.doesNotMatch(text, /\d+\.\d+/, "a version");
    assert.doesNotMatch(text, /pre-?release|beta|latest/i, "a release status");
  });
}
