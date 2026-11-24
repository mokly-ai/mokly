import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

test("Emotion keeps an imported background image token in collected CSS", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-emotion-asset-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "background.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  await fs.writeFile(
    path.join(root, "background.mockup.mjs"),
    `
import {createElement} from "react";
import {ClassNames} from "@emotion/react";
import {defineScreen} from "@mokly/mokly";
import background from "./background.png";
export default defineScreen({
  title: "Background", description: "", relatedDocs: [],
  render: () => createElement(ClassNames, null, ({css}) =>
    createElement("div", {className: css({backgroundImage: "url(" + background + ")"})}, "Asset")),
});`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: root,
      entryFiles: ["background.mockup.mjs"],
      renderer: null,
      storiesFiles: [],
      moduleResolution: {
        ...bundleParams().moduleResolution,
        mainFields: ["module", "main"],
      },
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  const result = await sidecar.call<RenderResult>("renderScreen", {
    generation,
    handle: "background.mockup.mjs#default",
    entry: { path: "background", title: "Background" },
    props: {},
    viewport: "desktop",
    colorScheme: "light",
  });
  const css = result.styles.map((style) => style.css).join("\n");
  assert.ok(
    css.includes("background-image:url(mokly-asset:[background.png]);"),
    css,
  );
  await sidecar.call("shutdown");
});
