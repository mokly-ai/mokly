import { definePage, defineScreen, defineUseCase } from "@mokly/mokly";

import { createComponents } from "./components.js";
import { DesktopScreen, MobileScreen } from "./screens.js";

const metadata = {
  relatedDocs: ["notes.md"],
};

export function createArea(area: string, count: number, rows: number) {
  const components = createComponents(area);
  const screenPaths = Array.from(
    { length: count },
    (_, index) =>
      `${area}/screens/activity-group-${Math.floor(index / 10) + 1}/screen-${index + 1}`,
  );
  const groups = Array.from({ length: Math.ceil(count / 10) }, (_, index) =>
    screenPaths.slice(index * 10, index * 10 + 10),
  );
  const flows = groups.map((group) =>
    group.length === 1 ? [...group, screenPaths[0]!] : group,
  );
  return [
    ...components.action.entries,
    ...components.panel.entries,
    ...groups.flatMap((group, index) => [
      defineUseCase({
        ...metadata,

        path: `${area}/flows/flow-${index + 1}`,
        title: `Activity journey ${index + 1}`,
        description: "Review connected activities.",
        steps: flows[index]!.map((screenPath) => ({ screenPath })),
      }),
    ]),
    ...screenPaths.map((screenPath, index) => {
      const props = {
        area,
        index,
        rows,
        components,
        next: screenPaths[(index + 1) % count]!,
      };
      return defineScreen({
        path: screenPath,
        ...metadata,

        title: `Activity ${index + 1}`,
        description: "Review and manage workspace activity.",
        tags: ["activity", index % 2 ? "complete" : "in-progress"],
        useCasePaths: flows.flatMap((group, groupIndex) =>
          group.includes(screenPath)
            ? [`${area}/flows/flow-${groupIndex + 1}`]
            : [],
        ),
        mobile: <MobileScreen {...props} />,
        desktop: <DesktopScreen {...props} />,
      });
    }),
    definePage({
      ...metadata,

      slug: "guide",
      title: "Getting started",
      description: "A guide to workspace activity.",
      render: () =>
        `<!doctype html><html><head><title>Getting started</title><link rel="stylesheet" href="../../../assets/catalogue.css"></head><body><main><h1>Getting started</h1><p>Review activity and save your changes.</p><a href="mock:${screenPaths[0]}#summary">Open activity</a></main></body></html>`,
    }),
  ];
}
