import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeCatalogueChanges } from "../dist/server/changed.js";
import { serve } from "../dist/server/serve.js";

import { assertMoveDelivery } from "./helpers/move_delivery.js";
import { recordedLocationsFixture } from "./helpers/recorded_locations.js";
import { waitForClassifiedCount } from "./helpers/watched_catalogue.js";

for (const kind of ["screen", "component"] as const)
  for (const move of ["exporter", "index", "renderer"] as const)
    test(`${kind} generated references pair across a stable-path ${move} move`, async (t) => {
      const fixture = await movedFixture(kind, move);
      t.after(fixture.remove);
      const { config, after, git } = await fixture.current();
      assert.deepEqual(
        fixture.before.manifest.entries.map((entry) => entry.path),
        after.manifest.entries.map((entry) => entry.path),
      );
      assert.deepEqual(
        fixture.before.manifest.entries.map((entry) => entry.sourcePath),
        after.manifest.entries.map((entry) => entry.sourcePath),
      );
      const artifact = await compareReview(after, config, git, "main");
      assert.deepEqual(artifact.result.changes, []);
      assert.ok(
        [
          ...artifact.result.screens,
          ...artifact.result.components.flatMap((c) => c.variants),
        ].every((record) => record.state === "unchanged"),
      );
      const changes = await computeCatalogueChanges(
        config,
        "main",
        git,
        after.manifest,
      );
      assert.deepEqual(changes.changedEntries, []);
      await assertMoveDelivery(config, after);
      const server = await serve(config, {
        base: "main",
        port: 0,
        watch: false,
      });
      try {
        await waitForClassifiedCount(server.url, 0);
        const model = await (
          await fetch(`${server.url}/__mokly/catalogue.json`)
        ).json();
        assert.equal(model.changesStatus, "ready");
        assert.ok(
          [...model.screens, ...model.components].every(
            (entry) => !entry.changes.included,
          ),
        );
      } finally {
        await server.close();
      }
    });

for (const kind of ["screen", "component"] as const)
  test(`a ${kind} stylesheet edit remains visible with an exporting-module route move`, async (t) => {
    const fixture = await movedFixture(kind, "exporter");
    t.after(fixture.remove);
    await fixture.write("specs/styles.css", ".note { color: red; }");
    const { config, after, git } = await fixture.current();
    const artifact = await compareReview(after, config, git, "main");
    assert.ok(
      artifact.result.changes.some((change) =>
        change.reasons.some((reason) => reason.kind === "dependency"),
      ),
    );
    const records = [
      ...artifact.result.screens,
      ...artifact.result.components.flatMap((c) => c.variants),
    ];
    assert.ok(records.every((record) => record.state === "changed"));
    assert.ok(
      records.every((record) =>
        record.views.every((view) => !view.material && view.reasons?.length),
      ),
    );
    const server = await serve(config, { base: "main", port: 0, watch: false });
    try {
      await waitForClassifiedCount(server.url, 1);
    } finally {
      await server.close();
    }
  });

async function movedFixture(
  kind: "screen" | "component",
  move: "exporter" | "index" | "renderer",
) {
  const fixture = await recordedLocationsFixture({
    kind,
    ...(move === "index" ? {} : { entryPath: "invoice" }),
    renderer: move === "renderer",
  });
  if (move === "renderer") {
    await fs.rename(
      path.join(fixture.root, "renderer"),
      path.join(fixture.root, "rendering"),
    );
    const config = await fs.readFile(
      path.join(fixture.root, "mokly.config.ts"),
      "utf8",
    );
    await fixture.write(
      "mokly.config.ts",
      config.replace("renderer/render.tsx", "rendering/render.tsx"),
    );
  } else {
    await fs.unlink(path.join(fixture.root, "specs/invoice.mockup.ts"));
    await fixture.write(
      move === "index"
        ? "specs/invoice/index.mockup.ts"
        : "specs/billing.mockup.ts",
      move === "index"
        ? "import '../styles.css'; export {default} from '../definitions.js';"
        : "import './styles.css'; export {default} from './definitions.js';",
    );
  }
  return fixture;
}
