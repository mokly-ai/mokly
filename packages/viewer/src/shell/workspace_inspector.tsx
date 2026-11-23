/**
 * The inspector of a screen's or a component's workspace in the right
 * panel: Details with the comparison evidence, the Components of the shown
 * views, Props, and Usage. `inspector.tsx` renders the tabs.
 */

import type { ReactNode, RefObject } from "react";

import type { InspectorHandle } from "@mokly/ui/inspector";

import type { GeneratedComponentView } from "../components/views.js";

import type { Catalogue } from "./catalogue.js";
import type { DetailDelivery } from "./data_requests.js";
import { Inspector } from "./inspector.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { WorkspaceUsage } from "./workspace_usage.js";

/** How a reader picks an instance in the Components tab. */
interface InstancePicks {
  activeViewport: "desktop" | "mobile";
  focus(key: string, viewport: "desktop" | "mobile"): void;
  select(key: string, viewport: "desktop" | "mobile"): void;
  selectedKey?: string | undefined;
  setViewport(viewport: "desktop" | "mobile"): void;
}

export function WorkspaceInspector({
  catalogue,
  compared,
  data,
  delivery,
  inspectorRef,
  instances,
  previousPath,
  props,
  variantPath,
  views,
}: {
  catalogue: Catalogue;
  /** Whether a comparison is loaded, whose evidence Details then shows. */
  compared: boolean;
  data: WorkspaceData;
  delivery: DetailDelivery;
  inspectorRef: RefObject<InspectorHandle | null>;
  instances: InstancePicks;
  previousPath?: string | undefined;
  /** The Props tab's panel. */
  props: ReactNode;
  variantPath?: string | undefined;
  views: readonly GeneratedComponentView[];
}) {
  const showComponents =
    data.entry.kind === "screen" ||
    views.some((view) => view.usage?.instances.length);
  return (
    <Inspector
      catalogue={catalogue}
      data={data}
      inspectorRef={inspectorRef}
      panels={{
        ...(showComponents
          ? {
              components: (
                <WorkspaceInstances
                  activeViewport={instances.activeViewport}
                  data={data}
                  onFocus={instances.focus}
                  onSelect={instances.select}
                  onViewport={instances.setViewport}
                  {...(instances.selectedKey
                    ? { selectedKey: instances.selectedKey }
                    : {})}
                  views={views}
                />
              ),
            }
          : {}),
        details: (
          <WorkspaceEvidence
            compared={compared}
            data={data}
            {...(previousPath ? { previousPath } : {})}
            {...(variantPath ? { variantPath } : {})}
          />
        ),
        props,
        usage: <WorkspaceUsage data={data} delivery={delivery} />,
      }}
    />
  );
}
