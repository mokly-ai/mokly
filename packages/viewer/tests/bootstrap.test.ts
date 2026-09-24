import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { StaticDelivery } from "../src/navigation/delivery.js";
import {
  externalShellBootstrap,
  readShellBootstrap,
  readShellBootstrapState,
  resolveShellBootstrap,
  serializeShellBootstrap,
  shellBootstrap,
  shellBootstrapWithDelivery,
} from "../src/standalone/bootstrap.js";
import { viewerCatalogue, viewerView } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v2.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("static hydration adopts the finalized authenticated deployment", () => {
  const staged = readShellBootstrap({
    catalogue: { ...catalogue, deploymentId: "0".repeat(64) },
    context: {
      base: "main",
      comparisons: false,
      updateVersion: 0,
      delivery: {
        schemaVersion: 2,
        deploymentId: "0".repeat(64),
        canonicalPath: "/",
        comparisonUrl: null,
        idRoutes: {},
      },
    },
    view: { kind: "home" },
  });
  const delivery: StaticDelivery = {
    schemaVersion: 2,
    deploymentId: "a".repeat(64),
    canonicalPath: "/",
    comparisonUrl: null,
    idRoutes: {},
  };
  const finalized = shellBootstrapWithDelivery(staged, delivery);
  assert.equal(staged.catalogue.deploymentId, "0".repeat(64));
  assert.equal(staged.context.delivery?.deploymentId, "0".repeat(64));
  assert.equal(finalized.catalogue.deploymentId, "a".repeat(64));
  assert.equal(finalized.context.delivery, delivery);
});

test("validated shell bootstrap JSON retains its canonical bytes", () => {
  const display = viewerCatalogue(catalogue);
  const bootstrap = shellBootstrap(
    catalogue,
    viewerView(display, { ...defaultSelection, screenId: "home" }),
    {
      base: "origin/main",
      comparisons: false,
      updateVersion: 2,
    },
  );
  const serialized = serializeShellBootstrap(bootstrap);
  assert.equal(
    serializeShellBootstrap(readShellBootstrap(JSON.parse(serialized))),
    serialized,
  );
});

test("external shell bootstrap retains only the shared catalogue identity", () => {
  const display = viewerCatalogue(catalogue);
  const bootstrap = shellBootstrap(
    catalogue,
    viewerView(display, { ...defaultSelection, screenId: "home" }),
    {
      base: "origin/main",
      comparisons: false,
      updateVersion: 2,
    },
  );
  const external = externalShellBootstrap(bootstrap);
  assert.deepEqual(external.catalogue, {
    kind: "external",
    path: "/__mokly/catalogue.json",
    identity: catalogue.identity.id,
    revision: catalogue.revision,
  });
  const serialized = serializeShellBootstrap(external);
  const parsed = readShellBootstrapState(JSON.parse(serialized));
  assert.equal(serializeShellBootstrap(parsed), serialized);
  assert.deepEqual(resolveShellBootstrap(parsed, catalogue), bootstrap);
  assert.throws(
    () =>
      resolveShellBootstrap(parsed, {
        ...catalogue,
        revision: {
          ...catalogue.revision,
          evidence: catalogue.revision.evidence + 1,
        },
      }),
    /does not match the page/,
  );
});
