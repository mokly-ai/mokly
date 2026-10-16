/**
 * A small HTML catalogue that a spec owns, served with the file watcher so an
 * edit publishes, and the frame and request records its live specs read.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { Page, Request } from "@playwright/test";

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

/** Serve the fixture with the watcher; the spec closes it. */
export function serveLiveCatalogue() {
  return serveCatalogue(
    {
      "specs/home.screen.html": screenFile(
        "Home",
        '<h1>Home v1</h1><ui-card label="From home" count="2" active="true"></ui-card>',
      ),
      "specs/other.screen.html": screenFile("Other", "<h1>Other v1</h1>"),
      "specs/card.component.html": cardFile(),
      "specs/tour.use-case.yaml": tourFile("Tour"),
    },
    {},
    { watch: true },
  );
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
