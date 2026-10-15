export const axes = { viewport: "desktop", colorScheme: "light" };
const changed = { status: "ready", kind: "changed", included: true };
const address = { path: "start", title: "Start" };

export function scenarioFixture() {
  return {
    catalogue: {
      schemaVersion: 6,
      deploymentId: "ignored-deployment",
      screens: [
        { kind: "screen", path: "start", changes: changed, views: [axes] },
      ],
      pages: [{ kind: "page", path: "handbook", changes: changed }],
      documents: [{ kind: "document", path: "guide", changes: changed }],
      components: [{ kind: "component", path: "action", views: [axes] }],
      useCases: [{ kind: "use-case", path: "tour" }],
      removedEntries: [
        {
          entry: {
            kind: "screen",
            path: "old",
            changes: {
              status: "ready",
              kind: "removed",
              included: true,
            },
          },
        },
      ],
    },
    review: {
      schemaVersion: 7,
      screens: [
        {
          ...address,
          state: "changed",
          views: [
            {
              ...axes,
              state: "ignored-only",
              ignoredIds: ["clock"],
              reasons: [
                {
                  kind: "dependency",
                  path: "theme.css",
                  analysis: {
                    rules: [
                      {
                        ruleKey: "rule-1",
                        status: "matched",
                        selectors: [".start"],
                        changedComponentPaths: ["action"],
                        pageSelectors: [] as string[],
                      },
                    ],
                  },
                },
              ],
              excludedResources: [
                { path: "unused.css", reason: "no-matching-rule" },
              ],
            },
          ],
        },
      ],
      changes: [
        {
          kind: "screen",
          before: address,
          after: address,
          previousPath: "previous-start",
          reasons: [{ kind: "material" }],
        },
      ],
      affectedConsumers: [
        {
          changedComponentId: "action",
          consumer: { kind: "screen", path: "start" },
          evidence: [
            {
              side: "after",
              context: { kind: "screen", entry: address, ...axes },
              via: [{ componentId: "action", instanceKey: "primary" }],
            },
          ],
        },
      ],
    },
    inventory: {
      schemaVersion: 3,
      files: [
        { path: "static/theme.css", sha256: "ignored-digest", size: 10 },
        { path: "index.html", sha256: "ignored-digest", size: 20 },
      ],
    },
    closures: [
      { path: "start", ...axes, resources: ["theme.css", "mark.svg"] },
    ],
  };
}
