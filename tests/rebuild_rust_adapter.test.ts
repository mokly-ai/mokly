import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  behaviourTable,
  readRustScenario,
} from "../scripts/rebuild/behaviour-table.mjs";
import { adaptRustScenario } from "../scripts/rebuild/rust-adapter.mjs";
import type { RustScenario } from "../scripts/rebuild/rust-adapter.mjs";

function capture(): RustScenario {
  return {
    catalogue: {
      schemaVersion: 7,
      screens: [
        {
          kind: "screen",
          path: "home",
          views: [{ viewport: "mobile", colorScheme: "light" }],
          changes: { status: "ready", kind: "changed", included: true },
        },
      ],
      components: [],
      pages: [
        {
          kind: "page",
          path: "guide",
          changes: { status: "ready", kind: "changed", included: true },
        },
      ],
      documents: [],
      useCases: [],
      removedEntries: [
        {
          entry: {
            kind: "screen",
            path: "old",
            changes: { status: "ready", kind: "removed", included: true },
          },
        },
      ],
    },
    details: [
      {
        schemaVersion: 2,
        entry: { kind: "page", path: "guide" },
        resourceEvidence: {
          rules: [
            {
              stylesheet: "static/theme.css",
              selector: "",
              status: "excluded",
              owner: { kind: "entry" },
            },
          ],
          resources: [],
        },
      },
    ],
    review: {
      schemaVersion: 8,
      baseCommit: "ignored-commit",
      entries: [
        {
          kind: "screen",
          path: "home",
          state: "changed",
          included: true,
          reasons: [{ kind: "material" }],
          views: [
            {
              viewport: "mobile",
              colorScheme: "light",
              state: "changed",
              ignoredIds: ["chrome"],
              rules: [
                {
                  stylesheet: "static/theme.css",
                  selector: ".card",
                  status: "matched",
                  owner: { kind: "component", path: "card" },
                },
                {
                  stylesheet: "static/theme.css",
                  selector: "body",
                  status: "unresolved",
                  owner: { kind: "entry" },
                },
              ],
              resources: [
                { path: "static/image.svg", owner: { kind: "entry" } },
              ],
            },
          ],
        },
      ],
      affected: [
        {
          changedComponentId: "card",
          consumer: { kind: "screen", path: "home" },
          evidence: [
            {
              side: "before",
              context: {
                kind: "screen",
                entry: { path: "earlier-home" },
                viewport: "mobile",
                colorScheme: "light",
              },
              via: [{ componentId: "card", instanceKey: "ignored-instance" }],
            },
          ],
        },
      ],
      diagnostics: [],
    },
    inventory: { schemaVersion: 3, files: [{ path: "static/image.svg" }] },
    closures: [
      {
        path: "home",
        viewport: "mobile",
        colorScheme: "light",
        resources: ["static/image.svg", "static/theme.css"],
      },
    ],
  } as unknown as RustScenario;
}

test("Rust adapter reads split details, direct membership, affected sides, and rule owners", () => {
  const table = behaviourTable(capture(), adaptRustScenario);
  assert.equal(table.schemaVersion, 2);
  assert.deepEqual(table.availability, {
    catalogue: true,
    closures: true,
    inventory: true,
    review: true,
  });
  assert.equal(table.entries.length, 3);
  assert.equal(table.changes.length, 3);
  const view = table.views.find((view) => view.path === "home")!;
  assert.deepEqual(view.ignoredIds, ["chrome"]);
  assert.deepEqual(view.kept.map((record) => record.status).sort(), [
    "applies",
    "resource-change",
    "uncertain",
  ]);
  assert.ok(
    view.kept.some((record) =>
      record.owners.some((owner) => owner.path === "card"),
    ),
  );
  assert.deepEqual(
    table.views.find((view) => view.path === "guide")!.excluded,
    [{ resource: "theme.css", reason: "no-selector-hit" }],
  );
  assert.equal(table.affectedConsumers[0]?.evidence[0]?.path, "earlier-home");
  assert.deepEqual(table.resourceClosures[0]?.resources, [
    "image.svg",
    "theme.css",
  ]);
  assert.ok(!JSON.stringify(table).includes("ignored-commit"));
  assert.ok(!JSON.stringify(table).includes("ignored-instance"));
});

test("Rust adapter rejects each unsupported boundary before adapting fields", () => {
  for (const [field, version] of [
    ["catalogue", 6],
    ["review", 7],
    ["inventory", 2],
  ] as const) {
    const scenario = capture();
    scenario[field] = { schemaVersion: version } as never;
    assert.throws(() => adaptRustScenario(scenario), /Unsupported/);
  }
  assert.throws(
    () =>
      adaptRustScenario({
        details: [{ schemaVersion: 3 }],
      } as unknown as RustScenario),
    /Unsupported entry detail/,
  );
  assert.deepEqual(behaviourTable({}, adaptRustScenario).entries, []);
});

test("Rust capture loader and explicit CLI adapter read separate detail files", async (context) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-rust-adapter-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = capture();
  for (const [key, filename] of [
    ["catalogue", "catalogue.json"],
    ["review", "review.json"],
    ["details", "entry-details.json"],
    ["inventory", "export-inventory.json"],
    ["closures", "resource-closures.json"],
  ] as const)
    await fs.writeFile(
      path.join(directory, filename),
      JSON.stringify(input[key]),
    );
  assert.deepEqual(await readRustScenario(directory), input);
  const output = path.join(directory, "table.json");
  execFileSync(process.execPath, [
    fileURLToPath(
      new URL("../scripts/rebuild/behaviour-table.mjs", import.meta.url),
    ),
    directory,
    output,
    "--adapter=rust",
  ]);
  assert.deepEqual(
    JSON.parse(await fs.readFile(output, "utf8")),
    behaviourTable(input, adaptRustScenario),
  );
});
