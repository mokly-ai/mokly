/** Adapt catalogue index v7, entry detail v1, and review v8 captures. */
export function adaptRustScenario({
  catalogue,
  details,
  review,
  inventory,
  closures,
}) {
  for (const [name, input, version] of [
    ["catalogue", catalogue, 7],
    ["review", review, 8],
    ["export inventory", inventory, 3],
    ...(details ?? []).map((detail) => ["entry detail", detail, 1]),
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
  const removed = (catalogue?.removedEntries ?? []).map(({ entry }) => entry);
  const entries = [...current, ...removed];
  const results = (review?.entries ?? []).flatMap((entry) => [
    entry,
    ...(entry.variants ?? []),
  ]);
  const resultFor = (entry) =>
    results.find(
      (result) => result.path === entry.path && result.kind === entry.kind,
    );
  const changes = results
    .filter((entry) => entry.included)
    .map((entry) => ({
      kind: entry.kind,
      path: entry.path,
      previousPath: entry.previousPath,
      state: entry.state,
      reasons: entry.reasons.map((reason) => ({
        kind: reason.kind,
        path: reason.path ? resourcePath(reason.path) : undefined,
        ownerPath: reason.screenPath,
      })),
    }));
  for (const entry of entries) {
    if (
      entry.changes?.status !== "ready" ||
      !entry.changes.included ||
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
        entry.changes.kind === "unmodified" ? "unchanged" : entry.changes.kind,
      reasons: [],
    });
  }
  const views = [];
  for (const entry of entries) {
    const detail = details?.find(
      (detail) =>
        detail.entry.kind === entry.kind && detail.entry.path === entry.path,
    );
    const result = resultFor(entry);
    const documents =
      result?.views ??
      entry.views ??
      (entry.kind === "page"
        ? [{ resourceEvidence: detail?.resourceEvidence }]
        : []);
    for (const view of documents) {
      const evidence = result
        ? view
        : (detail?.views?.find(
            (detail) =>
              detail.viewport === view.viewport &&
              detail.colorScheme === view.colorScheme,
          )?.resourceEvidence ?? view.resourceEvidence);
      views.push({
        kind: entry.kind,
        path: entry.path,
        viewport: view.viewport ?? null,
        colorScheme: view.colorScheme ?? null,
        state: result ? view.state : null,
        ignoredIds: result ? view.ignoredIds : [],
        kept: kept(evidence, entry),
        excluded: (evidence?.rules ?? [])
          .filter((rule) => rule.status === "excluded")
          .map((rule) => ({
            resource: resourcePath(rule.stylesheet),
            reason: "no-selector-hit",
          })),
      });
    }
  }
  for (const entry of results) {
    if (
      entries.some(
        (record) => record.kind === entry.kind && record.path === entry.path,
      )
    )
      continue;
    for (const view of entry.views)
      views.push({
        kind: entry.kind,
        path: entry.path,
        viewport: view.viewport,
        colorScheme: view.colorScheme,
        state: view.state,
        ignoredIds: view.ignoredIds,
        kept: kept(view, entry),
        excluded: (view.rules ?? [])
          .filter((rule) => rule.status === "excluded")
          .map((rule) => ({
            resource: resourcePath(rule.stylesheet),
            reason: "no-selector-hit",
          })),
      });
  }
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
    affectedConsumers: (review?.affected ?? []).map((consumer) => ({
      component: consumer.changedComponentId,
      consumer: consumer.consumer,
      evidence: consumer.evidence.map((item) => ({
        side: item.side,
        kind: item.context.kind,
        path: item.context.entry.path,
        viewport: item.context.viewport,
        colorScheme: item.context.colorScheme,
        via: item.via.map((edge, depth) => ({
          depth,
          component: edge.componentId,
        })),
      })),
    })),
    views,
    exportedResources: (inventory?.files ?? []).flatMap((file) => {
      const match =
        /^(static|mokly-viewer\/diffs\/generations\/[^/]+\/snapshots\/(before|after))\/(.*)$/.exec(
          file.path,
        );
      if (!match || /^mokly-generated\/.*\.html?$/.test(match[3])) return [];
      return [
        {
          side: match[2] ?? "after",
          path: match[3].replace(/^mokly-generated\//, ""),
        },
      ];
    }),
    resourceClosures: (closures ?? []).map((closure) => ({
      path: closure.path,
      side: closure.side ?? "after",
      viewport: closure.viewport ?? null,
      colorScheme: closure.colorScheme ?? null,
      resources: closure.resources.map(resourcePath),
      kind:
        entries.find(
          (entry) =>
            entry.path === closure.path || entry.previousPath === closure.path,
        )?.kind ?? "unknown",
    })),
  };
}

function kept(evidence, entry) {
  return [
    ...(evidence?.rules ?? [])
      .filter((rule) => rule.status !== "excluded")
      .map((rule) => {
        const resource = resourcePath(rule.stylesheet);
        const selectors = rule.selector ? [rule.selector] : [];
        return {
          key: JSON.stringify([resource, selectors]),
          resource,
          selectors,
          status: rule.status === "matched" ? "applies" : "uncertain",
          owners: [owner(rule.owner, entry, selectors)],
        };
      }),
    ...(evidence?.resources ?? []).map((reference) => {
      const resource = resourcePath(reference.path);
      return {
        key: JSON.stringify([resource, []]),
        resource,
        selectors: [],
        status: "resource-change",
        owners: [owner(reference.owner, entry, [])],
      };
    }),
  ];
}

function owner(value, entry, selectors) {
  return value.kind === "component"
    ? { kind: "component", path: value.path, selectors: [] }
    : { kind: entry.kind, path: entry.path, selectors };
}

function resourcePath(value) {
  return value
    .replace(
      /^(?:static|mokly-viewer\/diffs\/generations\/[^/]+\/snapshots\/(?:before|after))\//,
      "",
    )
    .replace(/^mokly-generated\//, "");
}
