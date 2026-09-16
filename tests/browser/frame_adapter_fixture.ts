import fs from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import { adaptBrowseDocument } from "../../dist/browse/document_adapter.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import { projectCatalogue } from "../../dist/catalogue/projection.js";
import { loadConfig } from "../../dist/config/load.js";
import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";
import type {
  FrameEvent,
  MountedFrame,
} from "../../packages/viewer/dist/client/frame_adapter.js";
import type * as PostAdapter from "../../packages/viewer/dist/client/post_message_adapter.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";
import { createCatalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

export interface FrameTestWindow extends Window {
  mounted: MountedFrame;
  frameEvents: FrameEvent[];
  wire: Record<string, unknown>[];
  unsubscribe: () => void;
}
export async function crossOriginFixture(
  options?: Parameters<typeof componentEntrySource>[0],
  extraConfig = "",
) {
  const fixture = await createFixture(
    componentEntrySource(
      options ?? {
        body: '<action.Component label="Visible" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><action.Component moklyInstance="multiple" label="Multiple" disabled /><div style={{height:800}} /><div style={{height:100,overflow:"auto"}}><div style={{height:200}}/><action.Component moklyInstance="scroll" label="Scroll" /></div><MockLink to="action">Open Action</MockLink>',
        actionRender:
          "(props) => props.hidden ? null : props.disabled ? <><span>First root</span> Text root <strong>Last root</strong></> : <button style={{width:160,height:40}}>{props.label}</button>",
      },
    ),
    { extraConfig },
  );
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const catalogue = createCatalogue(compilation.manifest);
  const root = path.join(fixture.root, "site");
  await fs.mkdir(root);
  const files = new Map<string, string | Buffer>([
    [
      "index.html",
      '<!doctype html><body><iframe id="frame" style="width:390px;height:300px;border:0"></iframe></body>',
    ],
    ["static/silent.html", "<!doctype html><p>No inspector</p>"],
  ]);
  for (const [name, bytes] of compilation.outputs)
    if (name.endsWith(".html"))
      files.set(`static/${name}`, adaptBrowseDocument(bytes, name, catalogue));
  for (const [name, bytes] of loadBrowserClientModules())
    files.set(`__mokly/client/${name}`, bytes);
  for (const [name, bytes] of loadBrowserNavigationModules())
    files.set(`__mokly/navigation/${name}`, bytes);
  for (const [name, bytes] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), bytes);
  }
  const host = await serveStaticFiles(root);
  const frames = await serveStaticFiles(root, { allowedOrigin: host.url });
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "home",
  );
  if (home?.kind !== "screen") throw new Error("No fixture screen");
  const usage = home.componentViews![0]!;
  return {
    host,
    frames,
    root,
    catalogue: projectCatalogue({
      configPath: "mokly.config.ts",
      catalogue,
      changesStatus: "disabled",
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
    }),
    usage,
    async close() {
      await frames.close();
      await host.close();
      await removeFixture(fixture);
    },
  };
}
export async function mountCrossFrame(
  page: Page,
  fixture: Awaited<ReturnType<typeof crossOriginFixture>>,
  path = "/static/screens/home.mobile.html",
) {
  await page.goto(fixture.host.url);
  await page.evaluate(
    async ({ origin, usageJson, path }) => {
      const usage = JSON.parse(usageJson) as ComponentViewRecord;
      const state = window as unknown as FrameTestWindow;
      const { postMessageAdapter } = (await import(
        `${location.origin}/__mokly/client/post_message_adapter.js`
      )) as typeof PostAdapter;
      state.wire = [];
      state.frameEvents = [];
      window.addEventListener("message", (event) => {
        try {
          state.wire.push(JSON.parse(event.data));
        } catch {
          /* Test probe ignores non-JSON messages. */
        }
      });
      state.mounted = await postMessageAdapter({ frameOrigin: origin }).mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        { url: new URL(path, origin), usage: { status: "ready", ...usage } },
      );
      state.unsubscribe = state.mounted.subscribe((event) =>
        state.frameEvents.push(event),
      );
      await state.mounted.listInstanceBoundaries();
    },
    {
      origin: fixture.frames.url,
      usageJson: JSON.stringify(fixture.usage),
      path,
    },
  );
}
