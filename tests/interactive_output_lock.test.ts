import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { generatedBytes } from "../dist/build/generated_file.js";
import { acquireOutputLock } from "../dist/build/output_lock.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { NodeInteractiveServerFactory } from "../dist/interactive/server.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { ControlledInteractiveBundler } from "./helpers/interactive_server.js";
import {
  acceptedStyles,
  compileLiveStyles,
  interactiveStylesFixture,
} from "./helpers/interactive_styles.js";

for (const mode of ["derived", "committed"] as const) {
  test(
    `Live retains accepted sources and resources while a ${mode} writer waits`,
    { timeout: 30_000 },
    async (t) => {
      const fixture = await interactiveStylesFixture(mode);
      t.after(() => fixture.remove());
      const accepted = await acceptedStyles(fixture.root);
      const initial = await compileCatalogue(accepted.config);
      await writeCompilation(initial, accepted.config);
      const bundle = await compileLiveStyles(accepted);
      const server = await startCatalogueServer(accepted.config, {
        base: "main",
        changesStatus: "unavailable",
        componentRuntime: accepted,
        interactiveServerFactory: new NodeInteractiveServerFactory(
          new ControlledInteractiveBundler(),
        ),
        manifest: accepted.manifest,
        port: 0,
      });
      fixture.beforeRemove(() => server.close());
      assert.ok(server.interactiveOrigin);

      await fs.writeFile(
        path.join(fixture.entriesDir, "card.module.css"),
        ".card { color: seagreen; } .changed { color: blue; }",
      );
      const next = await acceptedStyles(fixture.root);
      const compilation = await compileCatalogue(next.config);
      const lock = await acquireOutputLock(fixture.root);
      let written = false;
      const writing = writeCompilation(compilation, next.config).then(() => {
        written = true;
      });
      fixture.beforeRemove(async () => {
        await lock.release();
        await writing;
      });

      async function assertAcceptedResources() {
        for (const [route, bytes] of accepted.styleOutputs) {
          const response: Response = await fetch(
            `${server.interactiveOrigin}/static/${route}`,
          );
          assert.equal(response.status, 200, route);
          assert.deepEqual(
            Buffer.from(await response.arrayBuffer()),
            generatedBytes(bytes),
            route,
          );
        }
        assert.equal(await compileLiveStyles(accepted), bundle);
      }

      await assertAcceptedResources();
      assert.equal(written, false, "the other writer still owns the lock");
      await lock.release();
      await writing;
      for (const [route, bytes] of compilation.outputs)
        assert.deepEqual(
          await fs.readFile(path.join(fixture.mockupsDir, route)),
          generatedBytes(bytes),
          route,
        );
      await assertAcceptedResources();

      server.replaceComponentRuntime(next);
      for (const [route, bytes] of next.styleOutputs) {
        const response: Response = await fetch(
          `${server.interactiveOrigin}/static/${route}`,
        );
        assert.equal(response.status, 200, route);
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          generatedBytes(bytes),
        );
      }
      assert.notEqual(await compileLiveStyles(next), bundle);
    },
  );
}
