import {
  MAX_SNAPSHOT_DOCUMENT_BYTES,
  createSnapshotPresentationLoader,
} from "../../packages/viewer/src/previews/presentation.js";

interface PresentationHarnessOptions {
  bodyBytes?: number;
  contentType?: string;
  finalUrl?: string;
  html?: string;
  status?: number;
}

interface PresentationHarnessResult {
  credentials: RequestCredentials | undefined;
  snapshotAddress: string;
  srcdoc: string;
}

declare global {
  interface Window {
    loadPreviewPresentation(
      options?: PresentationHarnessOptions,
    ): Promise<PresentationHarnessResult>;
    inspectPreviewAddresses: typeof inspectPreviewAddresses;
    previewDocumentAddress: string;
    previewDocumentLimit: number;
  }
}

const generation =
  "https://artifact.test/mokly-viewer/diffs/generations/presentation/";
const snapshotAddress = `${generation}snapshots/before/archive/page.html`;

function byteBody(size: number): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(1024 * 1024).fill(97);
  let remaining = size;
  return new ReadableStream({
    pull(controller) {
      if (remaining === 0) {
        controller.close();
        return;
      }
      const length = Math.min(bytes.byteLength, remaining);
      controller.enqueue(bytes.subarray(0, length));
      remaining -= length;
    },
  });
}

function response(options: PresentationHarnessOptions): Response {
  const body = options.bodyBytes
    ? byteBody(options.bodyBytes)
    : (options.html ?? "<!doctype html><p>Previous page</p>");
  const value = new Response(body, {
    headers: {
      "content-type": options.contentType ?? "text/html; charset=utf-8",
    },
    status: options.status ?? 200,
  });
  Object.defineProperty(value, "url", {
    value: options.finalUrl ?? snapshotAddress,
  });
  return value;
}

window.previewDocumentAddress = snapshotAddress;
window.previewDocumentLimit = MAX_SNAPSHOT_DOCUMENT_BYTES;
window.inspectPreviewAddresses = inspectPreviewAddresses;
window.loadPreviewPresentation = async (options = {}) => {
  let credentials: RequestCredentials | undefined;
  const loader = createSnapshotPresentationLoader(
    generation,
    ["before"],
    { kind: "pinned", comparisonUrl: generation },
    {
      baseUrl: generation,
      fetch: async (_input, init) => {
        credentials = init?.credentials;
        return response(options);
      },
      parse: (source) => new DOMParser().parseFromString(source, "text/html"),
    },
  );
  const presentation = await loader.load(
    snapshotAddress,
    new AbortController().signal,
  );
  return { credentials, ...presentation };
};

async function inspectPreviewAddresses() {
  const { srcdoc } = await window.loadPreviewPresentation({
    html: `<!doctype html>
      <base target="_self"><base href="../assets/"><base href="https://ignored.test/">
      <link rel="stylesheet" href="theme.css">
      <style>.tile { background: url(wall.svg); }</style>
      <img src="dot.svg" srcset="thumb.svg 1x, wide.svg 2x" style="mask: url(mask.svg)">
      <a id="notes" href="notes.txt">Notes</a><a id="jump" href="#target">Jump</a>
      <map name="places"><area href="#target"></map>
      <video poster="poster.jpg"></video>
      <object data="map.svg"></object><div data="keep.txt"></div>
      <svg xmlns:xlink="http://www.w3.org/1999/xlink">
        <use href="#icon" xlink:href="#other"/>
        <a xlink:href="#target"></a>
        <style>.tile { fill: url(#gradient); }<!-- keep -->.tile { stroke: url(outline.svg); }</style>
      </svg>
      <div><template shadowrootmode="open">
        <template><img src="shadow.svg"></template>
      </template></div>
      <iframe id="nested" srcdoc="<base href='frame/' target='_blank'><base href='ignored/'><img src='inner.svg'><iframe srcdoc=&quot;<img src='deep.svg'>&quot;></iframe>"></iframe>
      <iframe id="unchanged" srcdoc="<p  title='Raw'>Keep me</p> "></iframe>`,
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(srcdoc, "text/html");
  const nested = parser.parseFromString(
    doc.querySelector<HTMLIFrameElement>("#nested")?.srcdoc ?? "",
    "text/html",
  );
  const deeper = parser.parseFromString(
    nested.querySelector("iframe")?.srcdoc ?? "",
    "text/html",
  );
  const xlink = "http://www.w3.org/1999/xlink";
  const image = doc.querySelector("img");
  return {
    baseCount: doc.querySelectorAll("base").length,
    src: image?.src,
    srcset: image?.srcset,
    stylesheet: doc.querySelector("link")?.href,
    link: doc.querySelector<HTMLAnchorElement>("#notes")?.href,
    fragment: doc.querySelector<HTMLAnchorElement>("#jump")?.href,
    area: doc.querySelector("area")?.href,
    poster: doc.querySelector("video")?.poster,
    objectData: doc.querySelector("object")?.data,
    unrelatedData: doc.querySelector("div[data]")?.getAttribute("data"),
    svgUse: doc.querySelector("svg use")?.getAttribute("href"),
    svgXlinkUse: doc.querySelector("svg use")?.getAttributeNS(xlink, "href"),
    svgLink: doc.querySelector("svg a")?.getAttributeNS(xlink, "href"),
    styleAttribute: image?.getAttribute("style"),
    styleText: doc.querySelector("style")?.textContent,
    svgStyle: doc.querySelector("svg style")?.innerHTML,
    templateImage: doc
      .querySelector("template")
      ?.content.querySelector("template")
      ?.content.querySelector("img")?.src,
    nestedBases: Array.from(nested.querySelectorAll("base"), (base) => ({
      href: base.getAttribute("href"),
      target: base.getAttribute("target"),
    })),
    nestedImage: nested.querySelector("img")?.src,
    deeperImage: deeper.querySelector("img")?.src,
    unchanged: doc.querySelector<HTMLIFrameElement>("#unchanged")?.srcdoc,
  };
}
