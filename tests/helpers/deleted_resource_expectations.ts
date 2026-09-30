import assert from "node:assert/strict";

import { MoklyError } from "../../dist/errors.js";

export type ClassifierName = "screen-level" | "unified";
export type RejectionKind =
  | "baseline-missing"
  | "current-missing"
  | "dangling"
  | "escaping"
  | "source-root"
  | "unsafe-view";

interface RejectionContext {
  resource: string;
  route: string;
  viewRoute: string;
}

export function rejected(
  unified: RejectionKind,
  screenLevel: RejectionKind,
): Readonly<Record<ClassifierName, RejectionKind>> {
  return { "screen-level": screenLevel, unified };
}

export function assertRejectedResource(
  reason: unknown,
  kind: RejectionKind,
  values: RejectionContext,
  context: string,
): void {
  assert.ok(reason instanceof MoklyError, `${context}: error class`);
  assert.deepEqual(
    { code: reason.code, message: reason.message },
    expectedRejection(kind, values),
    context,
  );
}

function expectedRejection(
  kind: RejectionKind,
  values: RejectionContext,
): { code: "review-invalid"; message: string } {
  const prefix = "[mokly/review-invalid]";
  const { resource, route, viewRoute } = values;
  switch (kind) {
    case "baseline-missing":
      return {
        code: "review-invalid",
        message: `${prefix} could not retain Review asset ${route}: not a regular Git file (missing)`,
      };
    case "current-missing":
      return {
        code: "review-invalid",
        message: `${prefix} referenced resource is missing: ${route}`,
      };
    case "dangling":
      return {
        code: "review-invalid",
        message: `${prefix} could not retain Review asset ${route}: ENOENT: no such file or directory, realpath '${resource}'`,
      };
    case "escaping":
      return {
        code: "review-invalid",
        message: `${prefix} could not retain Review asset ${route}: not a public static file`,
      };
    case "source-root":
      return {
        code: "review-invalid",
        message: `${prefix} could not retain Review asset ${route}: not a public static file: overlaps a resolved entry module (entries)`,
      };
    case "unsafe-view":
      return {
        code: "review-invalid",
        message: `${prefix} could not retain Review asset ${viewRoute}: asset URL escapes mockupsDir: ../../${route}`,
      };
  }
}
