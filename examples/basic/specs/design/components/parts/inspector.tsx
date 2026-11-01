import type { ReactNode } from "react";

import { useDesignInstance } from "../../library/composition.js";
import {
  inspector,
  type InspectorProps,
} from "../../library/inspector/inspector.js";

/** A tab of the shared inspector, by its saved name. */
export type InspectorTab = InspectorProps["tabs"][number]["id"];

export interface InspectorPanel {
  id: InspectorTab;
  label: string;
  content: ReactNode;
}

/** Screen-owned panel bodies cross the shared footer boundary as named slots. */
export function Inspector({
  panels,
  initial = "info",
}: {
  panels: readonly InspectorPanel[];
  initial?: InspectorTab | "closed";
}) {
  return (
    <inspector.Component
      moklyInstance={useDesignInstance("inspector")}
      tabs={panels.map(({ id, label }) => ({ id, label }))}
      initial={initial}
      sheetSize="compact"
      info={panels.find((panel) => panel.id === "info")?.content}
      components={panels.find((panel) => panel.id === "components")?.content}
      props={panels.find((panel) => panel.id === "props")?.content}
      usage={panels.find((panel) => panel.id === "usage")?.content}
    />
  );
}
