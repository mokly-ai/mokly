/** Prepare per-run CSS records for the catalogue replay's deep comparisons. */
export function fingerprintProofProjection(value) {
  const sources = value?.sources;
  const proof = sources?.cssProof;
  if (!(proof?.records instanceof WeakMap)) return value;
  const result = value.result;
  const records = [];
  const append = (reasons) => {
    for (const reason of reasons ?? [])
      if (reason.analysis !== undefined)
        records.push(proof.records.get(reason.analysis));
  };
  for (const change of result.changes ?? []) append(change.reasons);
  for (const screen of result.screens ?? [])
    for (const view of screen.views ?? []) append(view.reasons);
  for (const component of result.components ?? [])
    for (const variant of component.variants ?? [])
      for (const view of variant.views ?? []) append(view.reasons);
  return replace(
    value,
    "sources",
    replace(sources, "cssProof", replace(proof, "records", records)),
  );
}

/** Retain prototypes and every other own field without mutating live proof objects. */
function replace(value, key, replacement) {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  descriptors[key] = { ...descriptors[key], value: replacement };
  return Object.create(Object.getPrototypeOf(value), descriptors);
}
