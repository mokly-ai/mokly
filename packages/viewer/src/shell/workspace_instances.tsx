/**
 * The recorded component instance hierarchy of the active preview context.
 * This container picks the shown view, orders its instances, and builds their
 * tree with each component's title. `@mokly/ui/instance-tree` renders the
 * tree, its disclosures, and the viewport choice.
 */

import {
  InstanceTree,
  type InstanceNode,
  type InstanceTreeUsage,
} from "@mokly/ui/instance-tree";

import type {
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "../components/view_types.js";
import { orderedInstances } from "../components/views.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { WorkspaceData } from "./workspace_data.js";
import { WAITING_REASON } from "./workspace_inspection_runtime.js";

/**
 * The instances under one owner, the view itself or an instance, in their
 * order, each with the instances nested in it.
 */
function instanceNodes(
  data: WorkspaceData,
  instances: readonly ComponentInstanceRecord[],
  owner?: string,
): InstanceNode[] {
  return instances
    .filter((item) =>
      owner
        ? item.owner.kind === "instance" && item.owner.instanceKey === owner
        : item.owner.kind === "entry",
    )
    .map((instance) => ({
      id: instance.id,
      key: instance.key,
      nested: instanceNodes(data, instances, instance.key),
      title:
        data.components.find((item) => item.path === instance.componentId)
          ?.title ?? instance.componentId,
    }));
}

/** The shown view's instances, or why the tab shows none. */
function instanceUsage(
  data: WorkspaceData,
  usage: ComponentViewRecord | undefined,
): InstanceTreeUsage {
  if (!usage)
    return data.viewUsagePending
      ? { status: "waiting", text: WAITING_REASON }
      : { status: "unavailable" };
  return {
    components: new Set(usage.instances.map((item) => item.componentId)).size,
    instances: instanceNodes(data, orderedInstances(usage)),
    status: "ready",
    total: usage.instances.length,
  };
}

/** Components or nested components panel for the selected preview. */
export function WorkspaceInstances({
  activeViewport,
  data,
  onFocus,
  onSelect,
  onViewport,
  selectedKey,
  views,
}: {
  activeViewport: "desktop" | "mobile";
  data: WorkspaceData;
  onFocus(key: string, viewport: "desktop" | "mobile"): void;
  onSelect(key: string, viewport: "desktop" | "mobile"): void;
  onViewport(viewport: "desktop" | "mobile"): void;
  selectedKey?: string | undefined;
  views: readonly GeneratedComponentView[];
}) {
  const view =
    views.find((item) => item.viewport === activeViewport) ?? views[0];
  return (
    <InstanceTree
      onFocus={(key) => {
        if (view) onFocus(key, view.viewport);
      }}
      onSelect={(key) => {
        if (view) onSelect(key, view.viewport);
      }}
      onViewport={onViewport}
      selectedKey={selectedKey}
      usage={instanceUsage(data, view?.usage)}
      viewport={activeViewport}
      viewports={[...views].reverse().map((context) => ({
        key: `${context.viewport}/${context.colorScheme}`,
        viewport: context.viewport,
      }))}
    />
  );
}
