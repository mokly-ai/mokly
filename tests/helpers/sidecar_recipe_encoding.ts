import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";

import { bundleParams } from "./sidecar.js";
import { legacyJsonText } from "./sidecar_legacy_json.js";

export function recipeEncodingFixture(larger = "restore"): {
  params: BundleParams;
  result: BundleResult;
  reads: { code: number; path: number };
} {
  const edge = '"\\\b\t\n\f\r\u0000\u001f é中😀\ud800x\udfff';
  const params = bundleParams({
    sourceRoot: "/source",
    renderer: larger === "restore" ? "renderer".repeat(1024) : null,
  });
  const reads = { code: 0, path: 0 };
  const result: BundleResult = {
    generation: "generation",
    plan: { paths: [edge.repeat(32)], imports: [] },
    compiled: {
      identity: "identity",
      toolchain: "toolchain",
      metadataIdentity: "metadata",
      reuseEvidence: {
        complete: true,
        durable: false,
        inputs: { [edge]: { kind: "file", digest: edge.repeat(32) } },
      },
      get code() {
        reads.code++;
        return edge.repeat(16);
      },
      runtimeKey: "private",
      dependencyRoots: [],
      cssModules: [],
      sources: { [edge]: edge },
      peers: {},
      inputs: {},
      metadataInputs: {},
      inputDirectories: {},
      metadataDirectories: {},
    },
    modules: [
      {
        get path() {
          reads.path++;
          return edge;
        },
        imports: [edge],
      },
    ],
    ...(larger === "response"
      ? { unmappedDependencyDirectories: [edge.repeat(256)] }
      : {}),
  };
  return { params, result, reads };
}

export function recipeEnvelopeBytes(
  params: BundleParams,
  result: BundleResult,
) {
  const id = "18446744073709551615";
  const response = Buffer.byteLength(
    `{"id":${id},"result":${legacyJsonText(result)}}`,
  );
  const restore = Buffer.byteLength(
    `{"id":${id},"method":"restoreGeneration","params":${legacyJsonText({ generation: result.generation, params, compiled: result.compiled, modules: result.modules })}}`,
  );
  return { response, restore, bytes: Math.max(response, restore) };
}
export function oversizeCompleteRecipes(context: TestContext) {
  const original = Buffer.byteLength;
  const identities = new Map<string, string>();
  context.mock.method(
    Buffer,
    "byteLength",
    (...args: Parameters<typeof Buffer.byteLength>) => {
      const [value] = args;
      if (
        typeof value === "string" &&
        value.includes('"reuseEvidence":{"complete":true,')
      ) {
        const counted: unknown = JSON.parse(value);
        assert.ok(counted && typeof counted === "object");
        assert.ok(
          "identity" in counted && typeof counted.identity === "string",
        );
        assert.ok(
          "runtimeKey" in counted && typeof counted.runtimeKey === "string",
        );
        assert.ok(
          "metadataIdentity" in counted &&
            typeof counted.metadataIdentity === "string",
        );
        identities.set(counted.runtimeKey, counted.identity);
        return 64 * 1024 * 1024 + 1;
      }
      return original(...args);
    },
  );
  return identities;
}
