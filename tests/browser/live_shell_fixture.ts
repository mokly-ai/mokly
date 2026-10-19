/**
 * A small HTML catalogue that a spec owns, served with the file watcher so an
 * edit publishes, a local port forwarder, and the frame and request records
 * its live specs read.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import type { Page, Request } from "@playwright/test";

import type { CatalogueReadModel, EntryDetailV1 } from "@mokly/viewer";

import { serveCatalogue } from "./catalogue_fixture.js";

/** One screen of the fixture; both screens are steps of the use case `tour`. */
export function screenFile(title: string, body: string): string {
  return `---\ntitle: ${title}\nuseCasePaths: [tour]\n---\n<main>${body}</main>\n`;
}

/** The component `card`, with a text, a number, and a boolean prop. */
export function cardFile(marker = ""): string {
  return [
    "---",
    "title: Card",
    "element: ui-card",
    "propSchema: {type: object, additionalProperties: false, required: [label, count, active], properties: {label: {type: string}, count: {type: number}, active: {type: boolean}}}",
    "props: {label: Hello, count: 1, active: false}",
    "---",
    `<article class="card">${marker}<span class="label">{{label}}</span> <span class="count">{{count}}</span><b mokly-if="$active">Active</b></article>`,
    "",
  ].join("\n");
}

/** The use case `tour`, whose title is no document input. */
export function tourFile(title: string): string {
  return `title: ${title}\nsteps:\n  - screenPath: home\n  - screenPath: other\n`;
}

/**
 * Serve the fixture with the watcher, once it is settled; the spec closes it.
 * `files` replaces or adds catalogue files, and `config` adds configuration.
 */
export async function serveLiveCatalogue({
  files = {},
  config = {},
}: {
  files?: Record<string, string>;
  config?: Record<string, unknown>;
} = {}) {
  const server = await serveCatalogue(
    {
      "specs/home.screen.html": screenFile(
        "Home",
        '<h1>Home v1</h1><ui-card label="From home" count="2" active="true"></ui-card>',
      ),
      "specs/other.screen.html": screenFile("Other", "<h1>Other v1</h1>"),
      "specs/card.component.html": cardFile(),
      "specs/tour.use-case.yaml": tourFile("Tour"),
      ...files,
    },
    config,
    { watch: true },
  );
  try {
    await settleLive(server.url);
  } catch (error) {
    await server.close();
    throw error;
  }
  return server;
}

/**
 * Wait until a served catalogue looks settled: the index revision is above
 * `after`, `until` holds for the index, Changes has left its preparing or
 * pending state, and every screen and component detail is at that revision
 * with no pending usage. Each publication on the event stream wakes the
 * check, so the wait needs no sleep. Returns the settled revision.
 *
 * The state does not show every publication still to come: after an edit,
 * Serve can publish a render completion that changes only the revision. So a
 * step after an edit accepts a later revision, and `until` names the result
 * that the edit must show, so that the wait cannot return before it.
 */
export async function settleLive(
  url: string,
  after = -1,
  until: (index: CatalogueReadModel) => boolean = () => true,
): Promise<number> {
  const response = await fetch(`${url}/mokly-viewer/events`);
  if (!response.ok || !response.body)
    throw new Error("The live publication stream is unavailable");
  const stream = response.body.getReader();
  try {
    for (;;) {
      const revision = await settledRevision(url, until);
      if (revision !== undefined && revision > after) return revision;
      if ((await stream.read()).done)
        throw new Error(
          "The live publication stream ended before Serve settled",
        );
    }
  } finally {
    await stream.cancel();
  }
}

/**
 * The index revision when `until` holds and Changes and the usage of every
 * view are settled.
 */
async function settledRevision(
  url: string,
  until: (index: CatalogueReadModel) => boolean,
): Promise<number | undefined> {
  const read = async <T>(route: string) =>
    (await (await fetch(`${url}/mokly-viewer/${route}`)).json()) as T;
  const index = await read<CatalogueReadModel>("index.json");
  if (!until(index) || ["preparing", "pending"].includes(index.changesStatus))
    return undefined;
  for (const entry of [...index.screens, ...index.components]) {
    const detail = await read<EntryDetailV1>(`entries/${entry.path}.json`);
    if (
      detail.revision !== index.revision ||
      detail.views.some((view) => view.usage.status === "pending")
    )
      return undefined;
  }
  return index.revision;
}

/**
 * Leave the page before Serve stops. Otherwise the stop cuts the open event
 * stream, and the browser reports that cut as a console error.
 */
export async function closeServe(
  page: Page,
  ...servers: { close(): Promise<void> }[]
): Promise<void> {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.goto("about:blank");
  for (const server of servers) await server.close();
}

/**
 * Forward another local port to a served catalogue, as a port forwarder
 * does: each request keeps its `Host`, which the forwarder records.
 */
export async function forwardServe(url: string) {
  const upstream = new URL(url);
  const hosts: string[] = [];
  const proxy = http.createServer((incoming, response) => {
    hosts.push(incoming.headers.host ?? "");
    const outgoing = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: incoming.url,
        method: incoming.method,
        headers: incoming.headers,
      },
      (reply) => {
        response.writeHead(reply.statusCode!, reply.headers);
        reply.pipe(response);
      },
    );
    outgoing.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    response.on("close", () => outgoing.destroy());
    incoming.pipe(outgoing);
  });
  await new Promise<void>((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", resolve);
  });
  return {
    port: (proxy.address() as AddressInfo).port,
    hosts,
    close: () =>
      new Promise<void>((resolve, reject) => {
        proxy.close((error) => (error ? reject(error) : resolve()));
        proxy.closeAllConnections();
      }),
  };
}

/** Replace a catalogue file in one rename, so the watcher never reads half. */
export async function replaceFile(
  root: string,
  name: string,
  contents: string,
): Promise<void> {
  const staging = path.join(root, ".edits");
  await fs.mkdir(staging, { recursive: true });
  const staged = path.join(staging, randomUUID());
  await fs.writeFile(staged, contents);
  await fs.rename(staged, path.join(root, name));
}

/** The published revision and live generation of a served catalogue. */
export async function liveIndex(
  url: string,
): Promise<{ revision: number; generation: string | undefined }> {
  const index = (await (
    await fetch(`${url}/mokly-viewer/index.json`)
  ).json()) as { revision: number; live?: { generation: string } };
  return { revision: index.revision, generation: index.live?.generation };
}

/** Mark each stage frame element; a replaced element loses its mark. */
export function tagFrames(page: Page): Promise<number> {
  return page.evaluate(() => {
    const frames = [
      ...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe"),
    ];
    frames.forEach((frame, index) => {
      frame.dataset["specTag"] = String(index);
    });
    return frames.length;
  });
}

/** Each stage frame's mark, title, and text, read through the parent page. */
export function frameReport(
  page: Page,
): Promise<{ tag: string | null; title: string | null; text: string }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLIFrameElement>("#mb-main iframe")].map(
      (frame) => ({
        tag: frame.dataset["specTag"] ?? null,
        title: frame.getAttribute("title"),
        text: frame.contentDocument?.body?.innerText ?? "",
      }),
    ),
  );
}

/** Whether a request is a live prop render. */
export function isRender(request: Request): boolean {
  return (
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/mokly-viewer/components/render"
  );
}

/** The fields of a render request that the specs compare. */
export function renderBody(request: Request): {
  viewport: string;
  revision: number;
  label: unknown;
} {
  const body = request.postDataJSON() as {
    viewport: string;
    revision: number;
    overrides: Record<string, { value?: unknown }>;
  };
  return {
    viewport: body.viewport,
    revision: body.revision,
    label: body.overrides["label"]?.value,
  };
}
