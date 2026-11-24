import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("Vite style wrappers keep linked dependencies external and collect their CSS", async (context) => {
  await reportDuration(
    "Vite linked style registry",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const config = path.join(fixture.root, "vite.config.ts");
      await fs.writeFile(
        config,
        (await fs.readFile(config, "utf8")).replace(
          "resolve: {",
          "resolve: { preserveSymlinks: true,",
        ),
      );
      await fs.writeFile(
        path.join(fixture.root, "src/style.mockup.tsx"),
        `
      import styled from "styled-components";
      import { defineScreen } from "@mokly/mokly";
      const Button = styled.button\`color:purple;\`;
      export const screen = defineScreen({
        path: "style", title: "Style", description: "", relatedDocs: [],
        render: () => <Button>Linked style</Button>,
      });
    `,
      );
      const sidecar = startSidecar(context, fixture.root);
      await sidecar.call("hello");
      await assert.doesNotReject(async () => {
        const { generation } = await sidecar.call<BundleResult>("bundle", {
          ...fixture.params,
          entryFiles: ["src/style.mockup.tsx"],
          renderer: null,
        });
        await sidecar.call("cssModules", { generation, classMaps: {} });
        await installBindings(sidecar, generation);
        const result = await sidecar.call<RenderResult>("renderScreen", {
          generation,
          handle: "src/style.mockup.tsx#screen",
          entry: { path: "style", title: "Style" },
          props: {},
          viewport: "mobile",
          colorScheme: "light",
        });
        assert.match(result.html, /<button[^>]*>Linked style<\/button>/);
        assert.ok(
          result.styles.some(({ css }) => css.includes("color:purple")),
        );
      });
      await sidecar.call("shutdown");
    },
  );
});
