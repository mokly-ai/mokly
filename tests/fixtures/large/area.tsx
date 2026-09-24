import {
  defineCollection,
  definePage,
  defineScreen,
  defineUseCase,
} from "@mokly/mokly";

import { createComponents } from "./components.js";
import { DesktopScreen, MobileScreen } from "./screens.js";

const metadata = {
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
    defineCollection({
      ...metadata,
      id: area,
      title: area.replaceAll("-", " "),
      description: "A product workspace.",
      childIds: [
        `${area}-screens`,
        `${area}-components`,
        `${area}-flows`,
        `${area}-guide`,
      ],
    }),
    defineCollection({
      ...metadata,
      id: `${area}-screens`,
      title: "Screens",
      description: "Activity screens.",
      childIds: groups.map((_, index) => `${area}-group-${index + 1}`),
    }),
    defineCollection({
      ...metadata,
      id: `${area}-components`,
      title: "Components",
      description: "Shared elements.",
      childIds: [components.action.entry.id, components.panel.entry.id],
    }),
    defineCollection({
      ...metadata,
      id: `${area}-flows`,
      title: "Flows",
      description: "Connected journeys.",
      childIds: groups.map((_, index) => `${area}-flow-${index + 1}`),
    }),
    ...groups.flatMap((group, index) => [
      defineCollection({
        ...metadata,
        id: `${area}-group-${index + 1}`,
        title: `Activity group ${index + 1}`,
        description: "Related activities.",
        childIds: group,
      }),
      defineUseCase({
        ...metadata,
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
      id: `${area}-guide`,
      title: "Getting started",
      description: "A guide to workspace activity.",
      route: `${area}/guide.html`,
      render: () =>
        `<!doctype html><html><head><title>Getting started</title><link rel="stylesheet" href="../assets/catalogue.css"></head><body><main><h1>Getting started</h1><p>Review activity and save your changes.</p><a href="mock:${ids[0]}#summary">Open activity</a></main></body></html>`,
    }),
  ];
}
