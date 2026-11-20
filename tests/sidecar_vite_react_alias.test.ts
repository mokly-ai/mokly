import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { reactAliasFixture } from "./fixtures/vite_react_alias.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

for (const alias of ["same", "second", "string"] as const) {
  test(`a Vite React ${alias} alias selects one runtime for JSX, native packages, and rendering`, async (context) => {
    await reportDuration(
      `Vite React ${alias} alias`,
      (line) => context.diagnostic(line),
      async () => {
        const fixture = await reactAliasFixture(context, alias);
        const sidecar = startSidecar(context, fixture.root);
        await sidecar.call("hello");
        await assert.doesNotReject(async () => {
          const bundle = await sidecar.call<BundleResult>(
            "bundle",
            fixture.params,
          );
          assert.equal(
            bundle.compiled.peers.react,
            await fs.realpath(path.join(fixture.selected, "index.js")),
          );
          assert.equal(
            bundle.compiled.peers["react/package.json"],
            await fs.realpath(path.join(fixture.selected, "package.json")),
          );
          await sidecar.call("cssModules", {
            generation: bundle.generation,
            classMaps: {},
          });
          await installBindings(sidecar, bundle.generation);
          const result = await sidecar.call<RenderResult>("renderScreen", {
            generation: bundle.generation,
            handle: "src/react-alias.mockup.tsx#screen",
            entry: { path: "alias", title: "Alias" },
            props: {},
            viewport: "mobile",
            colorScheme: "light",
          });
          assert.equal(
            result.html,
            "<span>one runtime|source=true|native=true</span>",
          );
          assert.ok(
            Object.keys(bundle.compiled.metadataInputs).some((file) =>
              file.endsWith("react/package.json"),
            ),
          );
        });
        await sidecar.call("shutdown");
      },
    );
  });
}
