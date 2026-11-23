/**
 * The recorded component instance hierarchy of one frame's view: the frame
 * that holds the canvas selection, else the first shown frame. This
 * container orders the view's instances and builds their tree with each
 * component's title. `@mokly/ui/instance-tree` renders the tree and its
 * disclosures.
 */

import type { ComponentInstanceRecord } from "@mokly/model";
import {
  InstanceTree,
  type InstanceNode,
  type InstanceTreeUsage,
} from "@mokly/ui/instance-tree";

import type { ComponentViewRecord } from "../components/view_types.js";
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

/** The Components or Nested components section of one frame's view. */
export function WorkspaceInstances({
  data,
  onFocus,
  onSelect,
  selectedKey,
  view,
}: {
  data: WorkspaceData;
  /** Receives the instance to point out when a nested list opens or closes. */
  onFocus(key: string): void;
  onSelect(key: string): void;
  selectedKey?: string | undefined;
  /** The frame's view; none while the canvas shows no frame. */
  view: GeneratedComponentView | undefined;
}) {
  return (
    <InstanceTree
      onFocus={onFocus}
      onSelect={onSelect}
      selectedKey={selectedKey}
      usage={instanceUsage(data, view?.usage)}
      viewport={view?.viewport ?? "desktop"}
      viewports={[]}
    />
  );
}
