import fs from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";

import { adaptBrowseDocument } from "../../dist/browse/document_adapter.js";
import { compileCatalogue } from "../../dist/build/compile.js";
import { prepareLiveRuntime } from "../../dist/build/live_runtime.js";
import { loadConfig } from "../../dist/config/load.js";
import { EsbuildInteractiveBundleCompiler } from "../../dist/interactive/bundle.js";
import {
  buildInteractiveBootstrap,
  composeInteractiveDocument,
} from "../../dist/interactive/document.js";
import { loadBrowserClientModules } from "../../dist/server/client_modules.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type {
  FrameEvent,
  MountedFrame,
} from "../../packages/viewer/dist/client/frame_adapter.js";
import type * as PostAdapter from "../../packages/viewer/dist/client/post_message_adapter.js";
import { createCatalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

export interface InteractiveTestWindow extends Window {
  frameEvents: FrameEvent[];
  mounted: MountedFrame;
}

export async function interactiveFixture() {
  const fixture = await createFixture(interactiveSource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), rendererSource);
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const catalogue = createCatalogue(compilation.manifest);
  const generation = "browser_generation";
  const component = compilation.manifest.entries.find(
    (entry) => entry.kind === "component" && entry.id === "live-panel",
  );
  const broken = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "broken",
  );
  const home = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen" && entry.id === "home",
  );
  if (
    component?.kind !== "component" ||
    broken?.kind !== "screen" ||
    home?.kind !== "screen"
  )
    throw new Error("Interactive browser fixture entries are missing");
  const livePath = component.variants[0]?.fragments.mobile;
  const errorPath = broken.fragments.mobile;
  if (!livePath) throw new Error("Interactive component variant is missing");
  const files = new Map<string, string | Buffer>([
    [
      "index.html",
      '<!doctype html><body><iframe id="frame" style="width:390px;height:700px;border:0"></iframe></body>',
    ],
  ]);
  for (const [route, entryId, variantId] of [
    [livePath, "live-panel", "default"],
    [errorPath, "broken", undefined],
  ] as const) {
    const compiled = compilation.outputs.get(route);
    if (!compiled) throw new Error(`Missing compiled fixture route: ${route}`);
    const adapted = adaptBrowseDocument(compiled, route, catalogue);
    const built = buildInteractiveBootstrap({
      catalogueSchemes: config.colorSchemes,
      colorScheme: "light",
      entries: compilation.manifest.entries,
      entryId,
      generation,
      sourceRoute: route,
      ...(variantId ? { variantId } : {}),
      viewport: "mobile",
    });
    files.set(`static/${route}`, composeInteractiveDocument(adapted, built));
  }
  const homePath = home.fragments.mobile;
  const homeDocument = compilation.outputs.get(homePath);
  if (!homeDocument) throw new Error("Interactive home fixture is missing");
  const adaptedHome = adaptBrowseDocument(homeDocument, homePath, catalogue);
  const homeBootstrap = buildInteractiveBootstrap({
    catalogueSchemes: config.colorSchemes,
    colorScheme: "light",
    entries: compilation.manifest.entries,
    entryId: "home",
    generation,
    sourceRoute: homePath,
    viewport: "mobile",
  });
  const preMountPath = "/static/pre-mount.html";
  files.set(
    preMountPath.slice(1),
    composeInteractiveDocument(adaptedHome, {
      bootstrap: {
        ...homeBootstrap.bootstrap,
        entryId: "missing-entry",
      },
    }),
  );
  files.set(
    `__mokly/interactive/${generation}/bundle.js`,
    await new EsbuildInteractiveBundleCompiler().compile(config),
  );
  for (const [name, bytes] of loadBrowserClientModules())
    files.set(`__mokly/client/${name}`, bytes);
  const root = path.join(fixture.root, "site");
  for (const [name, bytes] of files) {
    const destination = path.join(root, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes);
  }
  const diagnostics: { body: unknown; pathname: string }[] = [];
  const host = await serveStaticFiles(root);
  const frames = await serveStaticFiles(root, {
    allowedOrigin: host.url,
    onPost({ body, pathname }) {
      diagnostics.push({ body: JSON.parse(body.toString()), pathname });
    },
  });
  return {
    diagnostics,
    errorPath: `/static/${errorPath}`,
    frames,
    host,
    livePath: `/static/${livePath}`,
    preMountPath,
    async close() {
      await frames.close();
      await host.close();
      await removeFixture(fixture);
    },
  };
}

/** Real Serve listener pair for the Milestone 4 happy-path browser contract. */
export async function interactiveServeFixture() {
  const fixture = await createFixture(interactiveSource(), {
    extraConfig: 'interactive: "serve", renderer: "renderer.tsx",',
  });
  await fs.writeFile(path.join(fixture.root, "renderer.tsx"), rendererSource);
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const diagnostics: unknown[] = [];
  const server = await startCatalogueServer(runtime.config, {
    base: "main",
    changesStatus: "unavailable",
    componentRuntime: runtime,
    manifest: runtime.manifest,
    onDiagnostic: (error) => diagnostics.push(error),
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  const component = runtime.manifest.entries.find(
    (entry) => entry.kind === "component" && entry.id === "live-panel",
  );
  const livePath =
    component?.kind === "component"
      ? component.variants[0]?.fragments.mobile
      : undefined;
  if (!livePath || !server.interactiveOrigin)
    throw new Error("Real Serve interactive fixture did not start");
  const prepared = await fetch(
    `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
    { headers: { origin: server.url }, method: "POST" },
  );
  if (!prepared.ok)
    throw new Error(`Real Serve bundle preparation failed: ${prepared.status}`);
  return {
    diagnostics,
    frames: { url: server.interactiveOrigin },
    host: { url: server.url },
    livePath: `/static/${livePath}`,
    async close() {
      await removeFixture(fixture);
    },
  };
}

export async function mountInteractiveFrame(
  page: Page,
  fixture: {
    frames: { url: string };
    host: { url: string };
    livePath: string;
  },
  framePath = fixture.livePath,
): Promise<void> {
  await page.goto(fixture.host.url);
  await page.evaluate(() => {
    if (document.querySelector("#frame")) return;
    const frame = document.createElement("iframe");
    frame.id = "frame";
    frame.style.cssText = "width:390px;height:700px;border:0";
    document.body.append(frame);
  });
  await page.evaluate(
    async ({ framePath, frameOrigin }) => {
      const state = window as unknown as InteractiveTestWindow;
      const { postMessageAdapter } = (await import(
        `${location.origin}/__mokly/client/post_message_adapter.js`
      )) as typeof PostAdapter;
      state.frameEvents = [];
      state.mounted = await postMessageAdapter({ frameOrigin }).mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        {
          onEvent: (event) => state.frameEvents.push(event),
          url: new URL(framePath, frameOrigin),
          usage: { status: "pending" },
        },
      );
    },
    { frameOrigin: fixture.frames.url, framePath },
  );
}

const rendererSource = `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export default function render(input) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Live fixture</title></head><body data-mokly-viewport="' + input.viewport + '"><style id="body-retained-style">body{margin:0}</style><script id="body-retained-script" type="application/json">{}</script>' + renderToStaticMarkup(input.node) + '</body></html>';
}
export function interactive(input) {
  return <div data-live-provider={input.colorScheme}>{input.node}</div>;
}
`;

function interactiveSource(): string {
  return `import React, { useState } from "react";
import { defineCollection, defineComponent, defineScreen, mockLink, MockLink, ReviewIgnore } from "@mokly/mokly";
const metadata = { dependencies: [], relatedDocs: [] };
function StatefulPanel({ label }) {
  const [count, setCount] = useState(0);
  const [rawLink, setRawLink] = useState(true);
  return <main>
    <p id="count">{label}: {count} items</p>
    <button id="increment" onClick={() => setCount(value => value + 1)}>Increment</button>
    <button id="toggle-raw-link" onClick={() => setRawLink(value => !value)}>Toggle raw link</button>
    <MockLink id="mock-link" to="details">Open details</MockLink>
    <MockLink asChild to="details"><button id="child-link">Open child details</button></MockLink>
    <a href={rawLink ? mockLink("details") : "/outside"} id="raw-link">Open raw details</a>
    <ReviewIgnore id="shared-chrome"><span>Shared chrome</span></ReviewIgnore>
  </main>;
}
const panel = defineComponent({ ...metadata, id: "live-panel", title: "Live panel", description: "Stateful component", route: "components/live-panel.html", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } }, render: props => <StatefulPanel label={props.label} />, variants: [{ id: "default", title: "Default", props: { label: "Saved" } }] });
function Broken() {
  if (typeof window !== "undefined") throw new Error("browser render exploded");
  return <main><p id="static-error-fallback">Static error fallback</p><MockLink id="static-error-link" to="details">Open static details</MockLink></main>;
}
export const mockups = [
  defineCollection({ ...metadata, childIds: ["live-panel", "home", "details", "broken"], description: "Live fixtures", id: "fixtures", title: "Fixtures" }),
  panel.entry,
  defineScreen({ ...metadata, description: "Home", desktop: <main id="static-pre-mount">Static pre-mount fallback</main>, id: "home", mobile: <main id="static-pre-mount">Static pre-mount fallback</main>, route: "screens/home.html", title: "Home" }),
  defineScreen({ ...metadata, description: "Details", desktop: <main>Details</main>, id: "details", mobile: <main>Details</main>, route: "screens/details.html", title: "Details" }),
  defineScreen({ ...metadata, description: "Broken", desktop: <Broken />, id: "broken", mobile: <Broken />, route: "screens/broken.html", title: "Broken" })
];
`;
}
