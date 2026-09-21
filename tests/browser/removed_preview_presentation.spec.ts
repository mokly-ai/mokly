import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

import type {} from "./removed_preview_presentation_entry.js";
import { serveStaticFiles } from "../helpers/static_server.js";

let fixture: Awaited<ReturnType<typeof serveStaticFiles>>;
let root = "";

test.beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-presentation-"));
  await fs.writeFile(
    path.join(root, "index.html"),
    "<!doctype html><title>Presentation</title>",
  );
  await build({
    bundle: true,
    entryPoints: ["tests/browser/removed_preview_presentation_entry.ts"],
    format: "iife",
    logLevel: "silent",
    outfile: path.join(root, "presentation.js"),
    platform: "browser",
    target: "es2023",
  });
  fixture = await serveStaticFiles(root);
});

test.afterAll(async () => {
  await fixture?.close();
  if (root) await fs.rm(root, { force: true, recursive: true });
});

async function start(page: Page): Promise<void> {
  await page.goto(fixture.url);
  await page.addScriptTag({ url: `${fixture.url}/presentation.js` });
}

async function inspect(page: Page, srcdoc: string) {
  return page.evaluate(
    (source) =>
      new Promise<Record<string, unknown>>((resolve) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-same-origin");
        frame.addEventListener("load", () => {
          const doc = frame.contentDocument!;
          resolve({
            base: doc.querySelector("base")?.getAttribute("href"),
            baseCount: doc.querySelectorAll("base").length,
            baseUri: doc.baseURI,
            bodyText: doc.body.textContent,
            compatMode: doc.compatMode,
            doctype: doc.doctype
              ? {
                  name: doc.doctype.name,
                  publicId: doc.doctype.publicId,
                  systemId: doc.doctype.systemId,
                }
              : null,
            firstHeadNode: doc.head.firstChild?.nodeName.toLowerCase(),
            lang: doc.documentElement.lang,
            refreshCount: doc.querySelectorAll("meta[http-equiv]").length,
            scriptExecuted:
              (doc.defaultView as Window & { previewExecuted?: boolean })
                .previewExecuted === true,
            scriptCount: doc.querySelectorAll("script").length,
            url: doc.URL,
          });
          frame.remove();
        });
        frame.srcdoc = source;
        document.body.append(frame);
      }),
    srcdoc,
  );
}

async function inspectDocumentNodes(page: Page, srcdoc: string) {
  return page.evaluate(
    (source) =>
      new Promise<string[]>((resolve) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-same-origin");
        frame.addEventListener("load", () => {
          const doc = frame.contentDocument!;
          resolve(
            Array.from(doc.childNodes, (node) => {
              if (node.nodeType === Node.COMMENT_NODE)
                return `comment:${(node as Comment).data}`;
              if (node.nodeType === Node.DOCUMENT_TYPE_NODE)
                return `doctype:${(node as DocumentType).name}`;
              return `element:${(node as Element).localName}`;
            }),
          );
          frame.remove();
        });
        frame.srcdoc = source;
        document.body.append(frame);
      }),
    srcdoc,
  );
}

test("historical markup becomes one faithful viewer-owned document", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(() =>
    window.loadPreviewPresentation({
      html: `<!doctype html><html lang="en"><head>
        <base href="../assets/"><base href="https://ignored.test/">
        <meta http-equiv=" \tReFrEsH\n " content="0; url=away.html">
        <title>Archived</title><script>window.previewExecuted=true</script></head><body><main>Kept body</main></body></html>`,
    }),
  );
  expect(result.credentials).toBe("omit");
  expect(await inspect(page, result.srcdoc)).toEqual({
    base: "https://artifact.test/__mokly/diffs/__generations/presentation/snapshots/before/assets/",
    baseCount: 1,
    baseUri:
      "https://artifact.test/__mokly/diffs/__generations/presentation/snapshots/before/assets/",
    bodyText: "Kept body",
    compatMode: "CSS1Compat",
    doctype: { name: "html", publicId: "", systemId: "" },
    firstHeadNode: "base",
    lang: "en",
    refreshCount: 0,
    scriptCount: 1,
    scriptExecuted: false,
    url: "about:srcdoc",
  });

  const quirks = await page.evaluate(() =>
    window.loadPreviewPresentation({
      html: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 3.2 Final//EN"><html lang="en"><body>Old</body></html>',
    }),
  );
  expect(await inspect(page, quirks.srcdoc)).toMatchObject({
    compatMode: "CSS1Compat",
    doctype: {
      name: "html",
      publicId: "-//W3C//DTD HTML 3.2 Final//EN",
      systemId: "",
    },
  });

  const implicit = await page.evaluate(() =>
    window.loadPreviewPresentation({
      html: '<html lang="fr"><body>Implicit</body></html>',
    }),
  );
  expect(await inspect(page, implicit.srcdoc)).toMatchObject({
    base: result.snapshotAddress,
    doctype: null,
    firstHeadNode: "base",
    lang: "fr",
  });

  const invalidBase = await page.evaluate(() =>
    window.loadPreviewPresentation({
      html: '<base href="http://["><base href="https://ignored.test/"><p>Fallback</p>',
    }),
  );
  expect(await inspect(page, invalidBase.srcdoc)).toMatchObject({
    base: result.snapshotAddress,
    baseCount: 1,
    firstHeadNode: "base",
  });

  const comments = await page.evaluate(() =>
    window.loadPreviewPresentation({
      html: "<!-- before --><!doctype html><html><body>Archived</body></html><!-- after -->",
    }),
  );
  expect(await inspectDocumentNodes(page, comments.srcdoc)).toEqual([
    "comment: before ",
    "doctype:html",
    "element:html",
    "comment: after ",
  ]);
});

test("historical fetches accept only the contracted response", async ({
  page,
}) => {
  await start(page);
  const accepted = await page.evaluate(() =>
    window.loadPreviewPresentation({
      finalUrl: window.previewDocumentAddress.slice(0, -".html".length),
    }),
  );
  expect(accepted.snapshotAddress).toBe(
    await page.evaluate(() => window.previewDocumentAddress),
  );

  const address = await page.evaluate(() => window.previewDocumentAddress);
  const limit = await page.evaluate(() => window.previewDocumentLimit);
  for (const options of [
    { finalUrl: address.replace("page.html", "other.html") },
    {
      finalUrl: address.replace("https://artifact.test", "https://other.test"),
    },
    { contentType: "application/octet-stream" },
    { bodyBytes: limit + 1 },
    { status: 404 },
  ])
    await expect(
      page.evaluate(
        (candidate) => window.loadPreviewPresentation(candidate),
        options,
      ),
    ).rejects.toThrow(/previous version is unavailable/i);
});
