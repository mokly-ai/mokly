/** Adapt read model v6, review v7, and export ownership v3 captures. */
export function adaptLegacyScenario({
  catalogue,
  review,
  inventory,
  closures,
}) {
  for (const [name, input, version] of [
    ["catalogue", catalogue, 6],
    ["review", review, 7],
    ["export inventory", inventory, 3],
  ])
    if (input && input.schemaVersion !== version)
      throw new Error(
        `Unsupported ${name} version: ${input.schemaVersion}; expected ${version}`,
      );
  const current = [
    "screens",
    "components",
    "pages",
    "documents",
    "useCases",
  ].flatMap((key) => catalogue?.[key] ?? []);
  const removed = catalogue?.removedEntries?.map(({ entry }) => entry) ?? [];
  const entries = [...current, ...removed];
  const results = [
    ...(review?.screens ?? []).map((entry) => ({ ...entry, kind: "screen" })),
    ...(review?.components ?? []).flatMap((entry) => [
      { ...entry, kind: "component" },
      ...(entry.variants ?? []).map((variant) => ({
        ...variant,
        kind: "component",
      })),
    ]),
  ];
  const resultFor = (kind, path) =>
    results.find((result) => result.kind === kind && result.path === path);
  const changes = (review?.changes ?? []).map((change) => {
    const address = change.after ?? change.before;
    return {
      kind: change.kind,
      path: address.path,
      previousPath: change.previousPath,
      state:
        resultFor(change.kind, address.path)?.state ??
        (!change.after ? "removed" : !change.before ? "added" : "changed"),
      reasons: change.reasons.map(reason),
    };
  });
  for (const entry of entries) {
    if (entry.changes?.status !== "ready" || !entry.changes.included) continue;
    if (
      changes.some(
        (change) => change.kind === entry.kind && change.path === entry.path,
      )
    )
      continue;
    changes.push({
      kind: entry.kind,
      path: entry.path,
      previousPath: entry.previousPath,
      state:
        resultFor(entry.kind, entry.path)?.state ??
        (entry.changes.kind === "unmodified"
          ? "unchanged"
          : entry.changes.kind),
      reasons: [],
    });
  }
  const views = new Map();
  const addViews = (entry, fromReview) => {
    const documents = entry.views ?? (entry.kind === "page" ? [entry] : []);
    for (const view of documents) {
      const key = JSON.stringify([
        entry.kind,
        entry.path,
        view.viewport,
        view.colorScheme,
      ]);
      const previous = views.get(key);
      const evidence = fromReview ? view : view.resourceEvidence;
      views.set(key, {
        kind: entry.kind,
        path: entry.path,
        viewport: view.viewport ?? null,
        colorScheme: view.colorScheme ?? null,
        state: fromReview ? view.state : (previous?.state ?? null),
        ignoredIds: fromReview
          ? (view.ignoredIds ?? [])
          : (previous?.ignoredIds ?? []),
        kept: evidence
          ? (evidence.reasons ?? []).flatMap(keptRules)
          : (previous?.kept ?? []),
        excluded: evidence
          ? (evidence.excludedResources ?? []).map((resource) => ({
              resource: resource.path,
              reason: resource.reason,
            }))
          : (previous?.excluded ?? []),
      });
    }
  };
  for (const entry of entries) addViews(entry, false);
  for (const entry of results) addViews(entry, true);
  return {
    availability: {
      catalogue: Boolean(catalogue),
      review: Boolean(review),
      inventory: Boolean(inventory),
      closures: Boolean(closures),
    },
    entries: entries.map((entry) => ({
      kind: entry.kind,
      path: entry.path,
      previousPath: entry.previousPath,
      removed: removed.includes(entry),
    })),
    changes,
    affectedConsumers: (review?.affectedConsumers ?? []).map((consumer) => ({
      component: consumer.changedComponentId,
      consumer: consumer.consumer,
      evidence: consumer.evidence.map((item) => ({
        side: item.side,
        kind: item.context.kind,
        path: item.context.entry.path,
        variantPath: item.context.variantPath,
        viewport: item.context.viewport,
        colorScheme: item.context.colorScheme,
        via: item.via.map((edge, depth) => ({ depth, ...edge })),
      })),
    })),
    views: [...views.values()],
    resourceClosures: (closures ?? []).map((closure) => ({
      ...closure,
      kind:
        entries.find(
          (entry) =>
            entry.path === closure.path || entry.previousPath === closure.path,
        )?.kind ?? "unknown",
    })),
  };
}

function reason(value) {
  return { kind: value.kind, path: value.path, screenPath: value.screenPath };
}

function keptRules(value) {
  if (!value.analysis?.rules?.length)
    return [
      {
        resource: value.path,
        status: value.analysis?.status ?? "resource",
        selectors: value.analysis?.selectors ?? [],
      },
    ];
  return value.analysis.rules.map((rule) => ({
    resource: value.path,
    status: rule.status,
    ruleKey: rule.ruleKey,
    selectors: rule.selectors,
    components: rule.changedComponentPaths,
    pageSelectors: rule.pageSelectors,
  }));
}
