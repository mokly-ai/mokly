import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

interface MetroConfiguration {
  watchFolders: string[];
  resolver: {
    disableHierarchicalLookup: boolean;
    nodeModulesPaths: string[];
    resolveRequest?: unknown;
  };
}

const require = createRequire(import.meta.url);
const configuration = require(
  resolve(repositoryRoot, "apps/app/metro.config.js"),
) as MetroConfiguration;

test("Metro uses Expo resolution with the shared workspace modules", () => {
  assert.deepEqual(configuration.watchFolders, [resolve(repositoryRoot, "ts")]);
  assert.deepEqual(configuration.resolver.nodeModulesPaths, [
    resolve(repositoryRoot, "apps/app/node_modules"),
    resolve(repositoryRoot, "node_modules"),
  ]);
  assert.equal(configuration.resolver.disableHierarchicalLookup, true);
  assert.equal(configuration.resolver.resolveRequest, null);
});
