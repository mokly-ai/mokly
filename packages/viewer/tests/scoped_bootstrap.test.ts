import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import type {
  CatalogueComponentVariant,
  CatalogueRecord,
} from "../src/catalogue/types.js";
import {
  serializeShellBootstrap,
  type ShellBootstrapView,
} from "../src/standalone/bootstrap.js";
import {
  readLiveShellBootstrap,
  readLiveShellBootstrapState,
  readScopedShellBootstrap,
} from "../src/standalone/scoped_bootstrap.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();
const context = {
  base: "origin/main",
  comparisons: true,
  updateVersion: 7,
};

test("scoped bootstraps for every entry shape round-trip canonical bytes", () => {
  const views: ShellBootstrapView[] = [
    { kind: "home" },
    { kind: "missing", requested: "not-here" },
    ...[
      ...model.screens,
      ...model.components,
      ...model.useCases,
      ...model.pages,
    ].map(target),
    ...model.removedEntries.map(({ entry, snapshotId }) => ({
      ...target(entry),
      ...(snapshotId ? { snapshotId } : {}),
    })),
  ];
  for (const view of views) {
    const bytes = scopedBytes(view);
    const parsed = readScopedShellBootstrap(JSON.parse(bytes));
    assert.equal(serializeShellBootstrap(parsed), bytes, JSON.stringify(view));
  }
});

test("the live reader accepts only exact entry scope", () => {
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  const view = target(screen);
  const complete = {
    schemaVersion: 2 as const,
    catalogue: model,
    context,
    view,
  };
  const scoped = JSON.parse(scopedBytes(view));
  assert.deepEqual(
    readLiveShellBootstrap(scoped),
    readScopedShellBootstrap(scoped),
  );
  assert.throws(
    () => readLiveShellBootstrap(complete),
    /out-of-scope usage must be omitted/i,
  );

  const hybrid = JSON.parse(scopedBytes(view));
  shellVariant(hybrid.catalogue).views[0]!.usage =
    firstVariant().views[0]!.usage;
  assert.throws(
    () => readLiveShellBootstrap(hybrid),
    /out-of-scope usage must be omitted/i,
  );
});

test("the live state reader leaves static external references unchanged", () => {
  const external = {
    schemaVersion: 2 as const,
    catalogue: {
      identity: model.identity.id,
      kind: "external",
      path: "/mokly-viewer/catalogue.json",
      revision: model.revision,
    },
    context,
    view: { kind: "home" as const },
  };
  assert.deepEqual(readLiveShellBootstrapState(external), external);
});

test("public catalogue reading still rejects shell-only omitted usage", () => {
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  const value = JSON.parse(scopedBytes(target(screen)));
  assert.throws(
    () => readCatalogue(value.catalogue),
    /unsupported discriminant/i,
  );
});

test("scoped reader rejects omitted usage on the selected entry", () => {
  const value = screenBootstrapValue();
  value.catalogue.screens[1].views[0].usage = { status: "omitted" };
  assert.throws(
    () => readScopedShellBootstrap(value),
    /in-scope usage cannot be omitted/i,
  );
});

test("scoped reader rejects leaked usage from another entry", () => {
  const value = screenBootstrapValue();
  shellVariant(value.catalogue).views[0]!.usage =
    firstVariant().views[0]!.usage;
  assert.throws(
    () => readScopedShellBootstrap(value),
    /out-of-scope usage must be omitted/i,
  );
});

test("scoped reader rejects missing and evidence-carrying omitted usage", () => {
  const missing = screenBootstrapValue();
  delete shellVariant(missing.catalogue).views[0]!.usage;
  assert.throws(() => readScopedShellBootstrap(missing));

  const malformed = screenBootstrapValue();
  shellVariant(malformed.catalogue).views[0]!.usage = {
    instances: [],
    ranges: [],
    slots: [],
    status: "omitted",
  };
  assert.throws(
    () => readScopedShellBootstrap(malformed),
    /cannot carry ready evidence/i,
  );
});

test("scoped reader retains hierarchy, axis, relationship and snapshot checks", () => {
  const mutations = [
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.tree = [];
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.screens[0].views.pop();
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.screens[1].path = "wrong/home";
    },
    (value: ReturnType<typeof screenBootstrapValue>) => {
      value.catalogue.removedEntries[1].snapshotId =
        value.catalogue.removedEntries[0].snapshotId;
    },
  ];
  for (const mutate of mutations) {
    const value = screenBootstrapValue();
    mutate(value);
    assert.throws(() => readScopedShellBootstrap(value), String(mutate));
  }
});

test("scoped reader rejects unknown targets and complete live bootstraps", () => {
  const unknown = screenBootstrapValue();
  unknown.view.entryPath = "not-present";
  assert.throws(() => readScopedShellBootstrap(unknown), /invalid.*target/i);
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  assert.throws(
    () =>
      readScopedShellBootstrap({
        schemaVersion: 2 as const,
        catalogue: model,
        context,
        view: target(screen),
      }),
    /out-of-scope usage must be omitted/i,
  );
});

test("the canonical public v6 fixture bytes are pinned", () => {
  const bytes = fs.readFileSync(
    new URL(
      "../../../docs/protocol/fixtures/catalogue-v6.json",
      import.meta.url,
    ),
  );
  assert.equal(bytes.byteLength, 12585);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "4514996f3e6a2cddeb5d015cdf6d58bb7a2b68cdda1283ac119b601060700793",
  );
  assert.doesNotThrow(() => readCatalogue(JSON.parse(bytes.toString("utf8"))));
});

function target(entry: Pick<CatalogueRecord, "path" | "kind">) {
  return {
    kind: "target" as const,
    entryPath: entry.path,
    entryKind: entry.kind,
  };
}

function scopedBytes(view: ShellBootstrapView): string {
  return serializeShellBootstrap({
    schemaVersion: 2,
    catalogue: projectScopedCatalogue(model, view),
    context,
    view,
  });
}

function screenBootstrapValue() {
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  return JSON.parse(scopedBytes(target(screen)));
}

function firstVariant(): CatalogueComponentVariant {
  return model.components.find(
    (entry): entry is CatalogueComponentVariant =>
      "variantOf" in entry && entry.variantOf === "components/action",
  )!;
}

function shellVariant(value: {
  components: Array<{
    variantOf?: string;
    views: Array<{ usage?: unknown }>;
  }>;
}) {
  return value.components.find(
    (entry) => "variantOf" in entry && entry.variantOf === "components/action",
  )!;
}
