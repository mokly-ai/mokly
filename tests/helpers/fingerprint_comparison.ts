import assert from "node:assert/strict";

import { prepareComponentProjection } from "../../dist/review/component_projection_resources.js";
import { compareComponentView } from "../../dist/review/component_view.js";

import type { FastPathFixture } from "./component_fast_path.js";
import { pageContext } from "./page_comparison.js";
import { selectedStyleViews } from "./style_route.js";

export function fingerprintMaterials(
  fixture: FastPathFixture,
  enabled = true,
  id = "home",
  path?: string,
) {
  const { before, after, root } = selectedStyleViews(fixture, id, path);
  const base = Buffer.from(fixture.beforeFiles.get(before.path)!).toString();
  const head = Buffer.from(fixture.afterFiles.get(after.path)!).toString();
  return prepareComponentProjection(
    { ...pageContext(fixture), useMaterialFingerprints: enabled },
    before,
    after,
    base,
    head,
    root,
  );
}

export function comparisonMaterials(
  prepared: ReturnType<typeof fingerprintMaterials>,
): readonly string[] {
  const { projected } = prepared;
  return [
    projected.actual.base,
    projected.actual.head,
    projected.before,
    projected.after,
  ];
}

export async function fingerprintComparison(
  fixture: FastPathFixture,
  enabled: boolean,
  id = "home",
  path?: string,
  switches = { useFastPath: false, useStylePath: false },
) {
  const { before, after, root } = selectedStyleViews(fixture, id, path);
  try {
    const result = await compareComponentView(
      {
        ...pageContext(fixture),
        ...switches,
        useMaterialFingerprints: enabled,
      },
      before,
      after,
      root,
    );
    return { kind: "result" as const, result };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return {
      kind: "error" as const,
      name: error.name,
      message: error.message,
      ...("code" in error ? { code: error.code } : {}),
    };
  }
}

export async function assertFingerprintComparison(
  fixture: FastPathFixture,
  id = "home",
  path?: string,
) {
  const old = await fingerprintComparison(fixture, false, id, path);
  const current = await fingerprintComparison(fixture, true, id, path);
  assert.deepEqual(current, old, `${id}/${path ?? "first"}: M8 text oracle`);
  return current;
}
