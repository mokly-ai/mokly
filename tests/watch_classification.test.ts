import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedConfig } from "../packages/mokly/dist/config/types.js";
import type {
  CatalogueChangeClassifier,
  ComponentChangeSnapshot,
} from "../packages/mokly/dist/server/component_changes.js";
import { WatchClassification } from "../packages/mokly/dist/server/watch_classification.js";

test("background classification aborts superseded work and publishes only the latest result", async () => {
  const pending: {
    resolve: (snapshot: ComponentChangeSnapshot) => void;
    signal: AbortSignal;
  }[] = [];
  const classifier: CatalogueChangeClassifier = {
    read(_config, _manifest, _base, signal) {
      assert.ok(signal);
      return new Promise((resolve) => pending.push({ resolve, signal }));
    },
  };
  const published: ComponentChangeSnapshot[] = [];
  const classification = new WatchClassification(classifier, (snapshot) =>
    published.push(snapshot),
  );
  const first = snapshot("first");
  const second = snapshot("second");

  classification.schedule(config(), manifest(), "main");
  classification.schedule(config(), manifest(), "main");
  assert.equal(pending[0]?.signal.aborted, true);
  pending[0]?.resolve(first);
  pending[1]?.resolve(second);
  await settled();

  assert.deepEqual(published, [second]);
});

test("closing background classification aborts work and prevents publication", async () => {
  let resolve: (snapshot: ComponentChangeSnapshot) => void = () => undefined;
  let signal: AbortSignal | undefined;
  const classifier: CatalogueChangeClassifier = {
    read(_config, _manifest, _base, activeSignal) {
      signal = activeSignal;
      return new Promise((complete) => {
        resolve = complete;
      });
    },
  };
  const published: ComponentChangeSnapshot[] = [];
  const classification = new WatchClassification(classifier, (snapshot) =>
    published.push(snapshot),
  );
  const result = snapshot("closed");

  classification.schedule(config(), manifest(), "main");
  classification.close();
  resolve(result);
  await settled();

  assert.equal(signal?.aborted, true);
  assert.deepEqual(published, []);
});

function snapshot(id: string): ComponentChangeSnapshot {
  return {
    baseline: {
      entries: [],
      generatedBy: "mokly",
      schemaVersion: 8 as const,
      folders: [],
      sourceFiles: [`${id}.html`],
    },
  };
}

function manifest() {
  return {
    entries: [],
    generatedBy: "mokly" as const,
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: [],
  };
}

function config(): ResolvedConfig {
  return {} as ResolvedConfig;
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}
