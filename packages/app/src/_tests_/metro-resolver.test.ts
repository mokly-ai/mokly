import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";

import { repositoryRoot } from "./root";

interface MetroConfiguration {
  watchFolders: string[];
  resolver: {
    blockList: RegExp[];
    disableHierarchicalLookup: boolean;
    nodeModulesPaths: string[];
    resolveRequest?: unknown;
  };
}

const require = createRequire(import.meta.url);
const configuration = require(
  resolve(repositoryRoot, "packages/app/metro.config.js"),
) as MetroConfiguration;

test("Metro uses Expo resolution with the shared workspace modules", () => {
  assert.deepEqual(configuration.watchFolders, [
    resolve(repositoryRoot, "node_modules"),
    resolve(repositoryRoot, "packages"),
  ]);
  assert.deepEqual(configuration.resolver.nodeModulesPaths, [
    resolve(repositoryRoot, "packages/app/node_modules"),
    resolve(repositoryRoot, "node_modules"),
  ]);
  assert.equal(configuration.resolver.disableHierarchicalLookup, true);
  assert.equal(configuration.resolver.resolveRequest, null);
});

test("Metro skips the desktop shell beside the app in the packages folder", () => {
  const blocked = (file: string) =>
    configuration.resolver.blockList.some((pattern) =>
      pattern.test(resolve(repositoryRoot, file)),
    );
  assert.equal(blocked("packages/desktop"), true);
  assert.equal(blocked("packages/desktop/release/latest.yml"), true);
  assert.equal(blocked("packages/desktop-other/index.ts"), false);
  assert.equal(blocked("packages/app/src/index.ts"), false);
  assert.equal(blocked("packages/viewer/src/index.ts"), false);
});
