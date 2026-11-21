import assert from "node:assert/strict";
import test from "node:test";

import {
  LANDING_SOURCE,
  editUrl,
  pageFacts,
  pageSource,
  sourceFile,
} from "../src/components/docs/page-source.js";
import { DOCS_PAGES, type DocsPage } from "../src/docs/pages.js";
import { PACKAGE_VERSION } from "../src/docs/version.js";

function page(id: string): DocsPage {
  const found = DOCS_PAGES.find((entry) => entry.id === id);
  assert.ok(found, `${id} is a documentation page`);
  return found;
}

test("the frame label, the Inspect meta and Edit on GitHub name each kind of page's tracked source", () => {
  const cases = [
    [
      pageSource(page("start/install")),
      "start/install.md",
      "install.md",
      "https://github.com/mokly-ai/mokly/edit/main/docs/guides/start/install.md",
    ],
    [
      pageSource(page("cloud/overview")),
      "cloud/overview.md",
      "overview.md",
      "https://github.com/mokly-ai/mokly/edit/main/apps/site/src/content/docs/cloud/overview.md",
    ],
    [
      pageSource(page("reference/upload")),
      "protocol/mokly-upload.md",
      "mokly-upload.md",
      "https://github.com/mokly-ai/mokly/edit/main/docs/protocol/mokly-upload.md",
    ],
    [
      LANDING_SOURCE,
      "docs/index.astro",
      "index.astro",
      "https://github.com/mokly-ai/mokly/edit/main/apps/site/src/pages/docs/index.astro",
    ],
  ] as const;
  for (const [source, label, file, url] of cases) {
    assert.equal(source.label, label);
    assert.equal(sourceFile(source), file, label);
    assert.equal(editUrl(source), url, label);
  }
});

test("only a page that the package owns names its version and package", () => {
  const packaged = (section: string) => [
    { label: "Section", value: section },
    { label: "Version", value: PACKAGE_VERSION },
    { label: "Package", value: "@mokly/mokly" },
  ];
  assert.deepEqual(
    pageFacts(pageSource(page("start/install")), "Getting started"),
    packaged("Getting started"),
  );
  assert.deepEqual(
    pageFacts(pageSource(page("reference/upload")), "Reference"),
    packaged("Reference"),
  );
  assert.deepEqual(
    pageFacts(pageSource(page("cloud/overview")), "Mokly Cloud"),
    [{ label: "Section", value: "Mokly Cloud" }],
  );
  assert.deepEqual(pageFacts(LANDING_SOURCE, "Documentation"), [
    { label: "Section", value: "Documentation" },
  ]);
});
