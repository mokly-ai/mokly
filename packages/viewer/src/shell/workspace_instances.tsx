/** Recorded component instance hierarchy for the active preview context. */

import { useState } from "react";

import type { ComponentInstanceRecord } from "../components/manifest_types.js";
import { orderedInstances } from "../components/views.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { WorkspaceData } from "./workspace_data.js";

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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const view =
    views.find((item) => item.viewport === activeViewport) ?? views[0];
  const usage = view?.usage;
  return (
    <>
      {views.length > 1 ? (
        <div>
          {[...views].reverse().map((context) => (
            <button
              aria-pressed={context.viewport === activeViewport}
              className="mbk-instance-context mbk-chip"
              key={`${context.viewport}/${context.colorScheme}`}
              onClick={() => onViewport(context.viewport)}
              type="button"
            >
              {context.viewport === "mobile" ? "Mobile" : "Desktop"}
              {` · ${context.colorScheme}`}
            </button>
          ))}
        </div>
      ) : null}
      {!usage ? (
        <p>Component inspection is unavailable for this view.</p>
      ) : !usage.instances.length ? (
        <p>No registered components are used in this view.</p>
      ) : (
        <>
          <p>
            {usage.instances.length} instances ·{" "}
            {new Set(usage.instances.map((item) => item.componentId)).size}
            {" components"}
          </p>
          <InstanceList
            data={data}
            expanded={expanded}
            instances={orderedInstances(usage)}
            onExpanded={(key, open, child) => {
              setExpanded((current) => {
                const next = new Set(current);
                if (open) next.add(key);
                else next.delete(key);
                return next;
              });
              onFocus(open && child ? child : key, view.viewport);
            }}
            onSelect={(key) => onSelect(key, view.viewport)}
            {...(selectedKey ? { selectedKey } : {})}
          />
        </>
      )}
    </>
  );
}

function InstanceList({
  data,
  expanded,
  instances,
  onExpanded,
  onSelect,
  owner,
  selectedKey,
}: {
  data: WorkspaceData;
  expanded: ReadonlySet<string>;
  instances: readonly ComponentInstanceRecord[];
  onExpanded(key: string, open: boolean, child?: string): void;
  onSelect(key: string): void;
  owner?: string | undefined;
  selectedKey?: string | undefined;
}) {
  const children = instances.filter((item) =>
    owner
      ? item.owner.kind === "instance" && item.owner.instanceKey === owner
      : item.owner.kind === "entry",
  );
  return (
    <ul className="mbk-instance-tree">
      {children.map((instance) => {
        const nested = instances.filter(
          (item) =>
            item.owner.kind === "instance" &&
            item.owner.instanceKey === instance.key,
        );
        const component = data.components.find(
          (item) => item.id === instance.componentId,
        );
        return (
          <li key={instance.key}>
            <button
              aria-pressed={selectedKey === instance.key}
              className="mbk-instance-select"
              data-instance-key={instance.key}
              onClick={() => onSelect(instance.key)}
              type="button"
            >
              {component?.title ?? instance.componentId}
              {` · ${instance.id}`}
            </button>
            {nested.length ? (
              <details
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  if (open === expanded.has(instance.key)) return;
                  onExpanded(instance.key, open, nested[0]?.key);
                }}
                open={expanded.has(instance.key)}
              >
                <summary>{nested.length} nested instances</summary>
                <InstanceList
                  data={data}
                  expanded={expanded}
                  instances={instances}
                  onExpanded={onExpanded}
                  onSelect={onSelect}
                  owner={instance.key}
                  {...(selectedKey ? { selectedKey } : {})}
                />
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
