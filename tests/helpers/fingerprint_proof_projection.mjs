import assert from "node:assert/strict";

import { canonicalJson } from "@mokly/viewer/data";

/** Compare complete CSS proof without its private WeakMap or collection order. */
export function fingerprintProofProjection(value) {
  const sources = value?.sources;
  const proof = sources?.cssProof;
  if (!proof) return value;
  assert.ok(
    proof.all.length > 0 || !hasCssRules(value.result),
    "CSS rule evidence has an empty collected proof",
  );
  const all = proof.all
    .map((rule) => ({ rule, key: canonicalJson(rule) }))
    .sort((left, right) =>
      left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
    )
    .map(({ rule }) => rule);
  const descriptors = Object.getOwnPropertyDescriptors(proof);
  delete descriptors.records;
  descriptors.all = { ...descriptors.all, value: all };
  const projected = Object.create(Object.getPrototypeOf(proof), descriptors);
  return replace(value, "sources", replace(sources, "cssProof", projected));
}

function hasCssRules(result) {
  const entries = [
    ...(result.changes ?? []),
    ...(result.screens ?? []).flatMap((screen) => screen.views ?? []),
    ...(result.components ?? []).flatMap((component) =>
      (component.variants ?? []).flatMap((variant) => variant.views ?? []),
    ),
  ];
  return entries.some((entry) =>
    entry.reasons?.some((reason) => reason.analysis?.rules?.length),
  );
}

/** Retain prototypes and every other own field without mutating live proof objects. */
function replace(value, key, replacement) {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  descriptors[key] = { ...descriptors[key], value: replacement };
  return Object.create(Object.getPrototypeOf(value), descriptors);
}
