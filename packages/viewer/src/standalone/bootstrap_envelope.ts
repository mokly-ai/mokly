/** Shared shell-bootstrap envelope types and context/view parsing. */

import {
  parseStaticDelivery,
  type StaticDelivery,
} from "../navigation/delivery.js";
import { isLogicalFragment } from "../navigation/logical.js";
import type { ViewerTheme } from "../viewer/types.js";

/** Route selection serialized independently of the catalogue payload form. */
export type ShellBootstrapView =
  | { kind: "home" }
  | { kind: "missing"; requested: string }
  | { kind: "target"; route: string };

/** Browser-safe standalone context serialized beside the catalogue payload. */
export interface ShellBootstrapContext {
  base: string;
  updateVersion: number;
  contentVersion?: number;
  previewGeneration?: string;
  comparisons: boolean;
  delivery?: StaticDelivery;
  fragment?: string;
  theme?: ViewerTheme;
}

/** Common envelope accepted by canonical standalone bootstrap serialization. */
export interface ShellBootstrapEnvelope<Catalogue> {
  catalogue: Catalogue;
  context: ShellBootstrapContext;
  view: ShellBootstrapView;
}

/** Read the shared context and view while leaving catalogue validation to its reader. */
export function readShellBootstrapEnvelope(
  value: unknown,
): ShellBootstrapEnvelope<unknown> {
  if (!isRecord(value) || !isRecord(value.context) || !isRecord(value.view))
    throw new Error("Invalid shell hydration state.");
  return {
    catalogue: value.catalogue,
    context: readContext(value.context),
    view: readView(value.view),
  };
}

function readContext(value: Record<string, unknown>): ShellBootstrapContext {
  if (
    typeof value["base"] !== "string" ||
    !isVersion(value["updateVersion"]) ||
    typeof value["comparisons"] !== "boolean"
  )
    throw new Error("Invalid shell hydration context.");
  const contentVersion = value["contentVersion"];
  const previewGeneration = value["previewGeneration"];
  const fragment = value["fragment"];
  const theme = value["theme"];
  if (contentVersion !== undefined && !isVersion(contentVersion))
    throw new Error("Invalid shell content version.");
  if (previewGeneration !== undefined && typeof previewGeneration !== "string")
    throw new Error("Invalid shell preview generation.");
  if (fragment !== undefined && !isLogicalFragment(fragment))
    throw new Error("Invalid shell fragment.");
  if (
    theme !== undefined &&
    theme !== "auto" &&
    theme !== "dark" &&
    theme !== "light"
  )
    throw new Error("Invalid shell appearance.");
  const delivery =
    value["delivery"] === undefined
      ? undefined
      : parseStaticDelivery(value["delivery"]);
  if (value["delivery"] !== undefined && !delivery)
    throw new Error("Invalid shell delivery metadata.");
  return {
    base: value["base"],
    updateVersion: value["updateVersion"],
    comparisons: value["comparisons"],
    ...(contentVersion === undefined ? {} : { contentVersion }),
    ...(previewGeneration === undefined ? {} : { previewGeneration }),
    ...(delivery === undefined ? {} : { delivery }),
    ...(fragment === undefined ? {} : { fragment }),
    ...(theme === undefined ? {} : { theme }),
  };
}

function readView(value: Record<string, unknown>): ShellBootstrapView {
  if (value["kind"] === "home") return { kind: "home" };
  if (value["kind"] === "missing" && typeof value["requested"] === "string")
    return { kind: "missing", requested: value["requested"] };
  if (value["kind"] === "target" && typeof value["route"] === "string")
    return { kind: "target", route: value["route"] };
  throw new Error("Invalid shell hydration view.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
