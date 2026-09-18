import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { evaluateBundle } from "../dist/build/consumer_bundle.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";
import { renderTransient } from "../dist/server/controls/transient.js";
import type { ComponentRenderRequest } from "../packages/viewer/dist/components/render_types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("Props renders only its view and freezes resources without copying linked pages", async (t) => {
  const source =
    componentEntrySource({
      actionRender: `(props) => <section>
    <button>{props.label}</button><img src="../../image.svg" alt="Example" />
    <a href="../../broken.html">Reference</a><MockLink to="home">Home</MockLink>
  </section>`,
    }) +
    `
    import { definePage } from "@mokly/mokly";
    mockups.push(definePage({ id: "broken", title: "Broken", description: "Broken page",
      route: "broken.html", dependencies: [], relatedDocs: [],
      render: () => { throw new Error("unrelated page must not render"); } }));
  `;
  const fixture = await createFixture(source);
  t.after(() => removeFixture(fixture));
  const asset = path.join(fixture.mockupsDir, "image.svg");
  await fs.writeFile(asset, '<svg width="12"/>');
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const service = new ComponentRenderService(runtime);
  t.after(() => service.close());
  const request: ComponentRenderRequest = {
    componentId: "action",
    variantId: "default",
    viewport: "desktop",
    colorScheme: "light",
    generation: runtime.generation,
    pageId: "a".repeat(32),
    overrides: { label: { kind: "set", value: ["string", "Edited"] } },
  };
  renderTransient(
    runtime,
    {
      ...evaluateBundle(runtime.bundle),
      entrySources: runtime.bundle.entrySources,
    },
    request,
  );
  const result = await service.render(request, new AbortController().signal);
  const bundle = service.store.get(result.renderId);
  assert.deepEqual(
    [...bundle.files.keys()].sort(),
    [bundle.route, "image.svg"].sort(),
  );
  const html = Buffer.from(bundle.files.get(bundle.route)!.bytes).toString();
  assert.match(html, /Edited/);
  assert.match(html, /href="\/static\/broken.html"/);
  assert.match(html, /href="\/static\/screens\/home.desktop.html"/);
  await fs.writeFile(asset, '<svg width="24"/>');
  assert.equal(
    Buffer.from(bundle.files.get("image.svg")!.bytes).toString(),
    '<svg width="12"/>',
  );
  assert.deepEqual(await fs.readdir(fixture.mockupsDir), ["image.svg"]);
});
