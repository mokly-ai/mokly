import { definePage, defineScreen, defineUseCase } from "@mokly/mokly";

import { createComponents } from "./components.js";
import { DesktopScreen, MobileScreen } from "./screens.js";

const metadata = {
  dependencies: ["entries/screens.tsx"],
  relatedDocs: ["notes.md"],
};

export function createArea(area: string, count: number, rows: number) {
  const components = createComponents(area);
  const ids = Array.from(
    { length: count },
    (_, index) => `${area}-screen-${index + 1}`,
  );
  const groups = Array.from({ length: Math.ceil(count / 10) }, (_, index) =>
    ids.slice(index * 10, index * 10 + 10),
  );
  const flows = groups.map((group) =>
    group.length === 1 ? [...group, ids[0]!] : group,
  );
  return [
    components.action.entry,
    components.panel.entry,
    ...groups.flatMap((group, index) => [
      defineUseCase({
        ...metadata,
        navPath: [area.replaceAll("-", " "), "Flows"],
        id: `${area}-flow-${index + 1}`,
        title: `Activity journey ${index + 1}`,
        description: "Review connected activities.",
        route: `user-flows/${area}/journey-${index + 1}.html`,
        steps: flows[index]!.map((screenId) => ({ screenId })),
      }),
    ]),
    ...ids.map((id, index) => {
      const props = {
        area,
        index,
        rows,
        components,
        next: ids[(index + 1) % count]!,
      };
      return defineScreen({
        ...metadata,
        navPath: [
          area.replaceAll("-", " "),
          "Screens",
          `Activity group ${Math.floor(index / 10) + 1}`,
        ],
        id,
        title: `Activity ${index + 1}`,
        description: "Review and manage workspace activity.",
        route: `${area}/screens/activity-${index + 1}.html`,
        tags: ["activity", index % 2 ? "complete" : "in-progress"],
        useCaseIds: flows.flatMap((group, groupIndex) =>
          group.includes(id) ? [`${area}-flow-${groupIndex + 1}`] : [],
        ),
        mobile: <MobileScreen {...props} />,
        desktop: <DesktopScreen {...props} />,
      });
    }),
    definePage({
      ...metadata,
      navPath: [area.replaceAll("-", " ")],
      id: `${area}-guide`,
      title: "Getting started",
      description: "A guide to workspace activity.",
      route: `${area}/guide.html`,
      render: () =>
        `<!doctype html><html><head><title>Getting started</title><link rel="stylesheet" href="../assets/catalogue.css"></head><body><main><h1>Getting started</h1><p>Review activity and save your changes.</p><a href="mock:${ids[0]}#summary">Open activity</a></main></body></html>`,
    }),
  ];
}
