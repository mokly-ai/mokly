import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { chromium } from "@playwright/test";
import { build } from "esbuild";

/** Bundle only installed public viewer entries and mount a real React host. */
export async function smokeBrowser(root, repositoryRoot) {
  const index = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "docs/protocol/fixtures/catalogue-v8.json"),
      "utf8",
    ),
  );
  const details = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, "docs/protocol/fixtures/entry-details-v2.json"),
      "utf8",
    ),
  );
  const entry = path.join(root, "host.jsx");
  await fs.writeFile(
    entry,
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { MoklyViewer, readCatalogueIndex, readEntryDetail } from "@mokly/viewer";
import { isEntryPath } from "@mokly/viewer/data";
import "@mokly/viewer/browser";
import "@mokly/viewer/styles.css";
const index = readCatalogueIndex(${JSON.stringify(index)});
const details = ${JSON.stringify(details.current)};
if (!isEntryPath(index.components[0].path)) throw new Error("invalid public path");
createRoot(document.getElementById("host")).render(<MoklyViewer index={index} baseUrl={location.origin} detail={(path) => readEntryDetail(details[path])} slots={{ topBarStart: <span>Installed viewer host</span> }} />);
`,
  );
  await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: path.join(root, "host.js"),
    loader: { ".woff2": "dataurl" },
  });
  const server = http.createServer(async (request, response) => {
    const file =
      request.url === "/host.js"
        ? "host.js"
        : request.url === "/host.css"
          ? "host.css"
          : undefined;
    response.setHeader(
      "content-type",
      file?.endsWith("js")
        ? "application/javascript"
        : file
          ? "text/css"
          : "text/html",
    );
    response.end(
      file
        ? await fs.readFile(path.join(root, file))
        : '<!doctype html><link rel="stylesheet" href="/host.css"><div id="host"></div><script type="module" src="/host.js"></script>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch(
      process.env.MOKLY_SMOKE_CHROME
        ? { executablePath: process.env.MOKLY_SMOKE_CHROME }
        : {},
    );
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByText("Installed viewer host", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
