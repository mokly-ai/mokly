import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { checkCompilation } from "../dist/build/check.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import {
  generatedBytes,
  generatedText,
  receiveGeneratedFile,
  transferGeneratedFile,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { CompilationAssetReader } from "../dist/review/compilation_assets.js";
import { handleControls } from "../dist/server/controls/http.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";
import { captureRenderBundle } from "../dist/server/controls/transient_assets.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { screenView } from "./helpers/component_views.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const route = "screens/home.mobile.html";
const assetRoute = "assets/binary.png";
const rawBytes = Uint8Array.from([0x00, 0xff, 0x80, 0x61]);

function binaryCompilation(
  compilation: Awaited<ReturnType<typeof compileCatalogue>>,
  bytes: Uint8Array,
) {
  const outputs = new Map<string, GeneratedFile>(compilation.outputs);
  const html = generatedText(outputs.get(route), route)!;
  const header = html.slice(0, html.indexOf("\n") + 1);
  outputs.set(route, Buffer.concat([Buffer.from(header), bytes]));
  return { ...compilation, outputs };
}

test("generated output retains non-UTF-8 bytes through write and Check", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const binary = binaryCompilation(compilation, rawBytes);

  await writeCompilation(binary, config);
  assert.deepEqual(
    await fs.promises.readFile(path.join(fixture.mockupsDir, route)),
    generatedBytes(binary.outputs.get(route)!),
  );
  checkCompilation(binary, config);
  await fs.promises.appendFile(path.join(fixture.mockupsDir, route), "changed");
  assert.throws(
    () => checkCompilation(binary, config),
    /stale generated files/,
  );
});

test("failed install restores the original binary after byte-safe staging", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const original = binaryCompilation(compilation, rawBytes);
  await writeCompilation(original, config);
  const replacement = binaryCompilation(
    compilation,
    Uint8Array.from([0xfe, 0x81]),
  );
  const target = path.join(fixture.mockupsDir, route);
  const rename = fs.promises.rename.bind(fs.promises);
  let inspectedStage = false;
  context.mock.method(
    fs.promises,
    "rename",
    async (from: string, to: string) => {
      if (from.includes(`${path.sep}stage${path.sep}`) && to === target) {
        inspectedStage = true;
        assert.deepEqual(
          await fs.promises.readFile(from),
          generatedBytes(replacement.outputs.get(route)!),
        );
        throw new Error("injected install failure");
      }
      return rename(from, to);
    },
  );
  await assert.rejects(
    writeCompilation(replacement, config),
    /injected install failure/,
  );
  assert.equal(inspectedStage, true);
  assert.deepEqual(
    await fs.promises.readFile(target),
    generatedBytes(original.outputs.get(route)!),
  );
});

test("derived export and review capture generated binary bytes without UTF-8 conversion", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const outputs = new Map<string, GeneratedFile>(compilation.outputs);
  outputs.set(assetRoute, rawBytes);
  const captured = await capturePublicFiles(
    { ...config, generatedOutput: "derived" },
    outputs,
  );
  assert.deepEqual(captured.get(assetRoute), Buffer.from(rawBytes));
  const reader = new CompilationAssetReader(outputs, {
    read: async () => {
      throw new Error("unexpected disk read");
    },
  });
  assert.deepEqual(await reader.read(assetRoute), Buffer.from(rawBytes));

  const html = generatedText(outputs.get(route), route)!;
  outputs.set(
    route,
    html.replace("</body>", `<img src="../${assetRoute}"></body>`),
  );
  const bundle = captureRenderBundle(
    route,
    outputs,
    compilation.manifest,
    config,
  );
  assert.deepEqual(bundle.get(assetRoute)?.bytes, Buffer.from(rawBytes));
  assert.equal(bundle.get(assetRoute)?.type, "image/png");
});

test("runtime and selected-review JSON transfers retain binary bytes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const runtime = componentRuntime(compilation);
  const message = componentRuntimeMessage({
    ...runtime,
    outputs: [...runtime.outputs, [assetRoute, rawBytes]],
  });
  const decoded = parseRuntimeMessage(JSON.parse(JSON.stringify(message)));
  assert.deepEqual(
    new Map(decoded?.runtime.outputs).get(assetRoute),
    Buffer.from(rawBytes),
  );
  assert.deepEqual(
    receiveGeneratedFile(
      JSON.parse(JSON.stringify(transferGeneratedFile(rawBytes))),
    ),
    Buffer.from(rawBytes),
  );
  assert.equal(
    receiveGeneratedFile({ kind: "bytes", base64: "invalid!" }),
    undefined,
  );
});

test("generated IPC preserves more than four MiB of opaque bytes", () => {
  const bytes = Buffer.alloc(4 * 1024 * 1024 + 127);
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = index % 251;
  assert.deepEqual(receiveGeneratedFile(transferGeneratedFile(bytes)), bytes);
});

test("props render captures linked CSS and binary assets from the accepted generation", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "render.css"),
    '.component{background:url("./picture.png")}',
  );
  await fs.promises.writeFile(
    path.join(fixture.entriesDir, "picture.png"),
    rawBytes,
  );
  await fs.promises.appendFile(fixture.entryPath, '\nimport "./render.css";\n');
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const runtime = componentRuntime(compilation);
  const service = new ComponentRenderService(runtime);
  context.after(() => service.close());
  const result = await service.render(
    {
      componentId: "action",
      variantId: "default",
      viewport: "desktop",
      colorScheme: "light",
      generation: runtime.generation,
      pageId: "a".repeat(32),
      overrides: {},
    },
    new AbortController().signal,
  );
  const captured = service.store.get(result.renderId);
  assert.ok(
    captured.files.has("mokly-generated/styles/entries/fixture.mockup.tsx.css"),
  );
  assert.deepEqual(
    Buffer.from(
      captured.files.get("mokly-generated/assets/entries/picture.png")!.bytes,
    ),
    Buffer.from(rawBytes),
  );
});

test("controls Serve sends synthetic generated asset bytes without decoding", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const outputs = new Map<string, GeneratedFile>(compilation.outputs);
  const html = generatedText(outputs.get(route), route)!;
  outputs.set(
    route,
    html.replace("</body>", `<img src="../${assetRoute}"></body>`),
  );
  outputs.set(assetRoute, rawBytes);
  const service = new ComponentRenderService(componentRuntime(compilation));
  context.after(() => service.close());
  const rendered = service.store.put(
    {
      route,
      props: {},
      view: screenView(compilation),
      files: captureRenderBundle(route, outputs, compilation.manifest, config),
    },
    "synthetic-generation",
  );
  const server = http.createServer((request, response) => {
    void handleControls(request, response, service);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/__mokly/components/renders/${rendered.renderId}/${assetRoute}`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    Buffer.from(rawBytes),
  );
});

test("Serve sends raw public binary bytes without decoding", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  const target = path.join(fixture.mockupsDir, assetRoute);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, rawBytes);
  const response = await fetch(`${server.url}/static/${assetRoute}`);
  assert.equal(response.status, 200);
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    Buffer.from(rawBytes),
  );
});
