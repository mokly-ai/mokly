import { definePage, defineScreen, defineUseCase } from "@mokly/mokly";

import { createComponents } from "./components.js";
import { areaPaths } from "./dimensions.js";
import { DesktopScreen, MobileScreen } from "./screens.js";

export function createArea(area: string, count: number, rows: number) {
  const components = createComponents(area);
  const { screens: screenPaths, flows } = areaPaths(area, count);
  const metadata = { relatedDocs: ["notes.md"] };
  return {
    action: components.action,
    panel: components.panel,
    flows: flows.map((group, i) =>
      defineUseCase({
        ...metadata,
        path: `${area}/flows/flow-${i + 1}`,
        title: `Activity journey ${i + 1}`,
        description: "Review connected activities.",
        steps: group.map((screenPath) => ({ screenPath })),
      }),
    ),
    screens: screenPaths.map((screenPath, index) =>
      defineScreen({
        ...metadata,
        path: screenPath,
        title: `Activity ${index + 1}`,
        description: "Review and manage workspace activity.",
        tags: ["activity", index % 2 ? "complete" : "in-progress"],
        useCasePaths: flows.flatMap((group, i) =>
          group.includes(screenPath) ? [`${area}/flows/flow-${i + 1}`] : [],
        ),
        props: { area, index, rows, next: screenPaths[(index + 1) % count]! },
        render: (props, { viewport }) =>
          viewport === "mobile" ? (
            <MobileScreen {...props} components={components} />
          ) : (
            <DesktopScreen {...props} components={components} />
          ),
      }),
    ),
    guide: definePage({
      ...metadata,
      path: `${area}/guide`,
      title: "Getting started",
      description: "A guide to workspace activity.",
      render: () =>
        `<!doctype html><html><head><title>Getting started</title><link rel="stylesheet" href="../../styles/assets/catalogue.css"></head><body><main><h1>Getting started</h1><p>Review activity and save your changes.</p><a href="mock:${screenPaths[0]}#summary">Open activity</a></main></body></html>`,
    }),
  };
}
