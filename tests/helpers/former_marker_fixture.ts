import type { ComponentViewRecord } from "@mokly/viewer";
import type { GeneratedComponentView } from "@mokly/viewer/data";

import { ComponentMaterialReader } from "../../dist/review/component_resources.js";
import type { ComponentViewContext } from "../../dist/review/component_view_types.js";
import { ResourceComparison } from "../../dist/review/resource_comparison.js";

export const formerMarkers = [
  ["component", "<!--mokabook-component:start:r-0-->"],
  ["ignore", "<!--mokabook-review-ignore:"],
  ["material", "<!--mokabook-review-material:"],
] as const;

export function markerView(
  before: string,
  after = before,
  usage?: ComponentViewRecord,
): { context: ComponentViewContext; view: GeneratedComponentView } {
  const view: GeneratedComponentView = {
    path: "plain/index.mobile.html",
    viewport: "mobile",
    colorScheme: "light",
    ...(usage ? { usage } : {}),
  };
  const reader = (html: string) =>
    new ComponentMaterialReader({ read: async () => Buffer.from(html) });
  const beforeReader = reader(before);
  const afterReader = reader(after);
  return {
    view,
    context: {
      beforeReader,
      afterReader,
      changed: new Set(),
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        new Set(),
        "mockups",
      ),
    },
  };
}

export function emptyUsage(): ComponentViewRecord {
  return {
    viewport: "mobile",
    colorScheme: "light",
    instances: [],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
    insertedStylesheets: [],
  };
}
