import { decodeProps } from "../components/codec.js";
import { canonicalJson } from "../components/data.js";

import {
  requireEqual,
  requireOrdered,
  reviewAddress,
  reviewArray,
  reviewId,
  reviewIgnoreId,
  reviewInvalid,
  reviewObject,
  reviewSides,
  reviewState,
  reviewString,
  reviewStrings,
} from "./result_helpers.js";
import {
  validateDependencyReason,
  validateResourceEvidence,
} from "./result_resources.js";

const screenKeys = ["id", "state", "title"];
export function validateReviewScreen(
  value: unknown,
  component = false,
  changedPaths: readonly string[] = [],
): Record<string, unknown> {
  const record = reviewObject(
    value,
    [...screenKeys, component ? "variants" : "views"],
    ["before", "after"],
  );
  reviewId(record.id);
  reviewString(record.title);
  reviewState(record.state);
  reviewSides(record);
  requireEqual(record.after ?? record.before, {
    id: record.id,
    title: record.title,
  });
  if (!component) validateReviewViews(record.views, record, changedPaths);
  else {
    const variants = reviewArray(record.variants);
    if (!variants.length) reviewInvalid("component variants are missing");
    const ids = new Set();
    let baselineOnly = false;
    for (const item of variants) {
      const variant = reviewObject(
        item,
        ["id", "title", "state", "views"],
        ["before", "after"],
      );
      reviewId(variant.id);
      reviewString(variant.title);
      reviewState(variant.state);
      if (ids.has(variant.id) || (!variant.before && !variant.after))
        reviewInvalid("invalid variant sides or identity");
      if (!variant.after) baselineOnly = true;
      else if (baselineOnly)
        reviewInvalid(
          "component variant order must put current variants before baseline-only variants",
        );
      ids.add(variant.id);
      for (const side of ["before", "after"] as const) {
        if (!variant[side]) continue;
        if (!record[side]) reviewInvalid("variant has no entry side");
        const address = reviewObject(
          variant[side],
          ["id", "title", "props", "suppliedSlots"],
          ["description"],
        );
        requireEqual(address.id, variant.id);
        reviewString(address.title);
        if (address.description !== undefined)
          reviewString(address.description);
        reviewStrings(address.suppliedSlots);
        decodeProps(address.props);
      }
      const preferred = reviewObject(
        variant.after ?? variant.before,
        ["id", "title", "props", "suppliedSlots"],
        ["description"],
      );
      requireEqual(preferred.title, variant.title);
      validateReviewViews(variant.views, variant, changedPaths);
    }
  }
  return record;
}
function validateReviewViews(
  value: unknown,
  sides?: Record<string, unknown>,
  changedPaths: readonly string[] = [],
): void {
  const views = reviewArray(value);
  if (!views.length) reviewInvalid("view evidence is missing");
  const keys: string[] = [];
  for (const item of views) {
    const view = reviewObject(
      item,
      ["viewport", "colorScheme", "ignoredIds", "state"],
      ["material", "reasons", "excludedResources"],
    );
    validateResourceEvidence(view, changedPaths);
    if (
      !["mobile", "desktop"].includes(String(view.viewport)) ||
      !["light", "dark"].includes(String(view.colorScheme))
    )
      reviewInvalid("invalid view context");
    keys.push(
      `${view.viewport === "mobile" ? 0 : 1}:${view.colorScheme === "light" ? 0 : 1}`,
    );
    reviewStrings(view.ignoredIds, reviewIgnoreId);
    reviewState(view.state);
    if (view.state === "added" && sides && !sides.after)
      reviewInvalid("added view has no after entry side");
    if (view.state === "removed" && sides && !sides.before)
      reviewInvalid("removed view has no before entry side");
  }
  requireOrdered(keys, (key) => key);
}
export function validateChangedEntry(
  value: unknown,
  changedPaths: readonly string[],
): Record<string, unknown> {
  const record = reviewObject(value, ["kind", "reasons"], ["before", "after"]);
  if (!["screen", "component", "use-case"].includes(String(record.kind)))
    reviewInvalid("unknown changed entry kind");
  reviewSides(record);
  const reasons = reviewArray(record.reasons);
  if (!reasons.length) reviewInvalid("change reasons are empty");
  const keys: string[] = [];
  for (const raw of reasons) {
    if (!raw || typeof raw !== "object" || !("kind" in raw))
      reviewInvalid("invalid reason");
    const reason = reviewObject(
      raw,
      raw.kind === "dependency"
        ? ["kind", "path"]
        : raw.kind === "screen"
          ? ["kind", "id"]
          : ["kind"],
      raw.kind === "dependency" ? ["analysis"] : [],
    );
    if (
      ![
        "added",
        "removed",
        "metadata",
        "material",
        "inputs",
        "structure",
        "dependency",
        "screen",
      ].includes(String(reason.kind))
    )
      reviewInvalid("unknown reason");
    if (
      (reason.kind === "added" && record.before) ||
      (reason.kind === "removed" && record.after)
    )
      reviewInvalid("reason conflicts with available sides");
    if (reason.kind === "dependency")
      validateDependencyReason(reason, changedPaths);
    if (reason.kind === "screen") {
      if (record.kind !== "use-case")
        reviewInvalid("screen propagation requires a use case");
      reviewId(reason.id);
    }
    keys.push(`${reason.kind}:${reason.path ?? reason.id ?? ""}`);
  }
  requireOrdered(keys, (key) => key);
  return record;
}
export function validateAffected(value: unknown): Record<string, unknown> {
  const record = reviewObject(value, [
    "changedComponentId",
    "consumer",
    "evidence",
  ]);
  reviewId(record.changedComponentId);
  const consumer = reviewObject(
    record.consumer,
    record.consumer &&
      typeof record.consumer === "object" &&
      "kind" in record.consumer &&
      record.consumer.kind === "screen"
      ? ["kind", "id"]
      : ["kind", "id"],
  );
  if (consumer.kind === "screen") reviewId(consumer.id);
  else if (consumer.kind === "component") reviewId(consumer.id);
  else reviewInvalid("invalid affected consumer");
  const evidence = reviewArray(record.evidence);
  if (!evidence.length) reviewInvalid("affected evidence is empty");
  const keys: string[] = [];
  for (const raw of evidence) {
    const item = reviewObject(raw, ["side", "context", "via"]);
    if (item.side !== "before" && item.side !== "after")
      reviewInvalid("invalid evidence side");
    const context = reviewObject(
      item.context,
      ["kind", "entry", "viewport", "colorScheme"],
      ["variantId"],
    );
    const entry = reviewAddress(context.entry);
    if (context.kind === "component") reviewId(context.variantId);
    else if (context.kind !== "screen" || context.variantId !== undefined)
      reviewInvalid("invalid usage context");
    if (
      !["mobile", "desktop"].includes(String(context.viewport)) ||
      !["light", "dark"].includes(String(context.colorScheme))
    )
      reviewInvalid("invalid usage view");
    const chain = reviewArray(item.via).map((raw) => {
      const edge = reviewObject(raw, ["componentId", "instanceKey"]);
      reviewId(edge.componentId);
      if (!/^[a-f0-9]{64}$/.test(reviewString(edge.instanceKey)))
        reviewInvalid("invalid instance key");
      return edge;
    });
    if (
      !chain.length ||
      chain.at(-1)!.componentId !== record.changedComponentId ||
      new Set(chain.map((edge) => edge.instanceKey)).size !== chain.length
    )
      reviewInvalid("invalid ownership chain");
    keys.push(
      `${item.side === "before" ? 0 : 1}\u0000${entry.id}\u0000${context.variantId ?? ""}\u0000${context.viewport === "mobile" ? 0 : 1}\u0000${context.colorScheme === "light" ? 0 : 1}\u0000${canonicalJson(chain)}`,
    );
  }
  requireOrdered(keys, (key) => key);
  return record;
}
