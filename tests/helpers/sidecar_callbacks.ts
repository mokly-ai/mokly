import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../../packages/mokly/src/generated/sidecar/Definitions.js";

import { consumer } from "./mokly_serve.js";
import { bundleParams, installBindings } from "./sidecar.js";
import type { startSidecar } from "./sidecar.js";

export const callbackEntry = "specs/callbacks.mockup.tsx";
export const callbackPrelude = `
import React from 'react';
import {defineComponent, defineScreen, definePage} from '@mokly/mokly';
const metadata = {title:'Callback',description:'Callback fixture',relatedDocs:[]};
`;

export function callbackConsumer(
  context: TestContext,
  source: string,
  files: Record<string, string> = {},
) {
  return consumer(context, {
    "mokly.config.json": '{"colorSchemes":["light","dark"]}',
    [callbackEntry]: callbackPrelude + source,
    ...files,
  });
}

export async function describeCallbacks(
  sidecar: ReturnType<typeof startSidecar>,
  root: string,
  renderer: string | null = null,
) {
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: root,
      entryFiles: [callbackEntry],
      storiesFiles: [],
      renderer,
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {},
  });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation: bundle.generation,
  });
  assert.deepEqual(definitions.diagnostics, []);
  await installBindings(sidecar, bundle.generation);
  return { bundle, definitions, generation: bundle.generation };
}
