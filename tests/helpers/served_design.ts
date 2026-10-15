import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import type { CatalogueReadModel } from "../../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";
import type { ColorScheme } from "../../packages/viewer/src/generated/catalogue/ColorScheme.js";
import type { EntryDetailV1 } from "../../packages/viewer/src/generated/catalogue/EntryDetailV1.js";
import type { Viewport } from "../../packages/viewer/src/generated/catalogue/Viewport.js";

import { repositoryRoot } from "./fixture.js";
import { shim } from "./mokly_serve.js";

export interface ServedView {
  path: string;
  kind: "screen" | "component";
  viewport: Viewport;
  colorScheme: ColorScheme;
  /** The view's file below the generated root, as relative links name it. */
  route: string;
  document: DefaultTreeAdapterMap["document"];
}

export interface ServedCatalogue {
  index: CatalogueReadModel;
  details: ReadonlyMap<string, EntryDetailV1>;
  views: readonly ServedView[];
}

export function viewRoute(
  path: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  return `${path}/index.${viewport}${colorScheme === "dark" ? ".dark" : ""}.html`;
}

/** Wait for Serve's listening line; the caller's signal bounds the wait. */
async function listening(
  child: ReturnType<typeof spawn>,
  signal: AbortSignal,
  stderr: () => string,
): Promise<string> {
  for await (const line of createInterface({ input: child.stdout!, signal })) {
    const match = /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(line);
    if (match) {
      child.stdout!.resume();
      return match[1]!;
    }
  }
  throw new Error(`Serve stopped before it listened: ${stderr()}`);
}

async function fetchAll<T>(
  items: readonly T[],
  load: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift())
        await load(item);
    }),
  );
}

/**
 * Serve the example catalogue, render every screen and component view, and
 * wait through publication events until every view's usage is recorded.
 */
export async function serveExample(signal: AbortSignal): Promise<{
  catalogue: ServedCatalogue;
  close(): Promise<void>;
}> {
  const child = spawn(
    process.execPath,
    [
      shim,
      "serve",
      "--config",
      "examples/basic/mokly.config.json",
      "--no-watch",
      "--port",
      "0",
      "--sidecars",
      "1",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, MOKLY_OUTPUT: "plain" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGINT");
    const [code] = await exited;
    assert.equal(code, 0, stderr);
  };
  try {
    const url = await listening(child, signal, () => stderr);
    const read = async (route: string) => {
      const response = await fetch(`${url}/${route}`, { signal });
      assert.equal(response.status, 200, route);
      return response;
    };
    const events = (await read("mokly-viewer/events")).body!.getReader();
    const index = readCatalogueIndex(
      await (await read("mokly-viewer/index.json")).json(),
    );
    const views: ServedView[] = [];
    const visual = [
      ...index.screens.map((entry) => ({ kind: "screen" as const, entry })),
      ...index.components.map((entry) => ({
        kind: "component" as const,
        entry,
      })),
    ];
    const pending = visual.flatMap(({ kind, entry }) =>
      entry.views.map((view) => ({
        path: entry.path,
        kind,
        viewport: view.viewport,
        colorScheme: view.colorScheme,
        route: viewRoute(entry.path, view.viewport, view.colorScheme),
      })),
    );
    await fetchAll(pending, async (view) => {
      const html = await (
        await read(`static/mokly-generated/${view.route}`)
      ).text();
      views.push({ ...view, document: parse(html) });
    });
    const details = new Map<string, EntryDetailV1>();
    let unsettled = visual.map(({ entry }) => entry.path);
    // Each publication can settle more usage, so recheck after every event.
    while (unsettled.length > 0) {
      await fetchAll(unsettled, async (path) => {
        const detail = readEntryDetail(
          await (await read(`mokly-viewer/entries/${path}.json`)).json(),
        );
        details.set(path, detail);
      });
      // A failed render leaves its usage unavailable and its consumers'
      // lists unproven, so only pending usage keeps the wait going then.
      const failed = [...details.values()].some((detail) =>
        detail.views.some((view) => view.usage.status === "unavailable"),
      );
      unsettled = unsettled.filter((path) => {
        const detail = details.get(path)!;
        return (
          detail.views.some((view) => view.usage.status === "pending") ||
          (!detail.workspace && !failed)
        );
      });
      if (unsettled.length > 0) await events.read();
    }
    await events.cancel();
    views.sort((a, b) => a.route.localeCompare(b.route));
    return { catalogue: { index, details, views }, close };
  } catch (error) {
    child.kill("SIGKILL");
    await exited;
    throw error;
  }
}
