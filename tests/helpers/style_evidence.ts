import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { EntryChangeReason } from "../../packages/viewer/dist/review/component_types.js";
import type { InlineStyleEvidence } from "../../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../../packages/viewer/dist/shell/workspace_evidence.js";

/** Render one focused Details evidence state without the surrounding shell. */
export function renderEvidence({
  affected = false,
  excluded = [],
  inlineStyles,
  reasons = [],
  status = "Changed",
  variant = false,
}: {
  affected?: boolean;
  excluded?: readonly string[];
  inlineStyles?: InlineStyleEvidence;
  reasons?: readonly EntryChangeReason[];
  status?: "Changed" | "Unmodified";
  variant?: boolean;
}): string {
  const route = variant ? "components/action.html" : "screens/home.html";
  const address = {
    id: variant ? "action" : "home",
    route,
    title: variant ? "Action" : "Home",
  };
  const data = {
    base: "main",
    status,
    ...(reasons.length
      ? {
          change: {
            kind: variant ? "component" : "screen",
            after: address,
            reasons,
          },
        }
      : {}),
    ...(affected
      ? {
          comparison: {
            ...address,
            before: address,
            after: address,
            dependencies: [],
            sharedImpact: [],
            state: "changed",
            views: [
              {
                beforePath: `snapshots/before/${route}`,
                afterPath: `snapshots/after/${route}`,
                colorScheme: "light",
                ignoredIds: [],
                state: "changed",
                viewport: "mobile",
              },
            ],
          },
        }
      : {}),
    components: [],
    comparisonEligible: status === "Changed",
    comparisons: true,
    entry: { ...address, kind: variant ? "component" : "screen" },
    inputChanges: [],
    relatedComponents: affected
      ? [{ title: "Action", route: "components/action.html" }]
      : [],
    resourceEvidence:
      excluded.length || inlineStyles
        ? [
            {
              colorScheme: "light",
              ...(excluded.length
                ? {
                    excludedResources: excluded.map((path) => ({
                      path,
                      reason: "no-matching-rule" as const,
                    })),
                  }
                : {}),
              ...(inlineStyles ? { inlineStyles } : {}),
              viewport: "mobile",
            },
          ]
        : [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(variant ? { variantId: "default" } : {}),
    }),
  );
}
