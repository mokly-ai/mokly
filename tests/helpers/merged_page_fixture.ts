import assert from "node:assert/strict";

import { ComponentMaterialReader } from "../../src/review/component_resources.js";
import { compareComponentView } from "../../src/review/component_view.js";
import { catalogueLinkNormalizer } from "../../src/review/moves/links.js";
import { ResourceComparison } from "../../src/review/resource_comparison.js";

import { html, instance, markedRange, range, view } from "./inline_styles.js";

export function mergedPage(head: string, ignored = false, styles = "") {
  const action = instance(1, "action");
  const link = `<link rel="stylesheet" href="../${head}">`;
  const source = html(
    styles +
      (ignored
        ? `<!--mokly-review-ignore:start:links-->${link}<!--mokly-review-ignore:end:links-->`
        : link),
    markedRange(0, '<button class="action">Action</button>') +
      '<main class="entry">Entry</main>',
  );
  const usage = {
    ...view({
      instances: [action],
      ranges: [range(0, { kind: "instance", instanceKey: action.key })],
    }),
    resources: [],
    insertedStylesheets: [
      {
        startOffset: source.indexOf(link),
        endOffset: source.indexOf(link) + link.length,
        path: head,
        componentPaths: ["action"],
      },
    ],
  };
  return {
    source,
    view: {
      path: "home/index.html",
      viewport: "mobile" as const,
      colorScheme: "light" as const,
      usage,
    },
  };
}

export async function compareMergedPage(
  before: ReturnType<typeof mergedPage>,
  after: ReturnType<typeof mergedPage>,
  files: { before: Record<string, string>; after: Record<string, string> },
  changed: readonly string[] = [],
  options: {
    useFastPath?: boolean;
    useStylePath?: boolean;
    useMaterialFingerprints?: boolean;
  } = {},
) {
  const reader = (page: typeof before, resources: Record<string, string>) =>
    new ComponentMaterialReader({
      read: async (route) => {
        const text = route === page.view.path ? page.source : resources[route];
        assert.notEqual(text, undefined, route);
        return Buffer.from(text!);
      },
    });
  const beforeReader = reader(before, files.before);
  const afterReader = reader(after, files.after);
  const paths = new Set(changed);
  return compareComponentView(
    {
      componentAware: true,
      links: catalogueLinkNormalizer([], [], []),
      beforeReader,
      afterReader,
      changed: paths,
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        paths,
        "mockups",
        undefined,
        undefined,
        true,
      ),
      ...options,
    },
    before.view,
    after.view,
  );
}
