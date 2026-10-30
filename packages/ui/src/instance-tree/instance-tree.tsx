/**
 * The Components tab of a workspace: the component instances that the shown
 * view records, as a tree in which an instance lists the instances nested in
 * it under a disclosure. A reader selects an instance with its button. When
 * the workspace shows two viewports, a choice of viewport comes first.
 */

import { useState } from "react";

/** One recorded component instance, with the instances nested in it. */
export interface InstanceNode {
  /** The instance's stable key, which its button carries in `data-instance-key`. */
  key: string;
  /** The instance's own id in the view. */
  id: string;
  /** The title of the instance's component, or its component id. */
  title: string;
  nested: readonly InstanceNode[];
}

/** A viewport that the tab can show the instances of. */
export type InstanceViewport = "desktop" | "mobile";

/** The instances of the shown view, or why the tab shows none. */
export type InstanceTreeUsage =
  /** The view's records load; the text says what the tab waits for. */
  | { status: "waiting"; text: string }
  /** The view has no records, so it cannot be inspected. */
  | { status: "unavailable" }
  | {
      status: "ready";
      /** The number of distinct components that the instances use. */
      components: number;
      /** The instances that the view itself holds, with their nested instances. */
      instances: readonly InstanceNode[];
      /** The number of all instances, nested ones included. */
      total: number;
    };

/** The instances under one owner, and each nested list under a disclosure. */
function InstanceList({
  expanded,
  instances,
  onExpanded,
  onSelect,
  selectedKey,
}: {
  expanded: ReadonlySet<string>;
  instances: readonly InstanceNode[];
  onExpanded: (key: string, open: boolean, child?: string) => void;
  onSelect: ((key: string) => void) | undefined;
  selectedKey: string | undefined;
}) {
  return (
    <ul className="mbk-instance-tree">
      {instances.map((instance) => (
        <li key={instance.key}>
          <button
            aria-pressed={selectedKey === instance.key}
            className="mbk-instance-select"
            data-instance-key={instance.key}
            onClick={() => onSelect?.(instance.key)}
            type="button"
          >
            {instance.title}
            {` · ${instance.id}`}
          </button>
          {instance.nested.length ? (
            <details
              onToggle={(event) => {
                const open = event.currentTarget.open;
                if (open === expanded.has(instance.key)) return;
                onExpanded(instance.key, open, instance.nested[0]?.key);
              }}
              open={expanded.has(instance.key)}
            >
              <summary>{instance.nested.length} nested instances</summary>
              <InstanceList
                expanded={expanded}
                instances={instance.nested}
                onExpanded={onExpanded}
                onSelect={onSelect}
                selectedKey={selectedKey}
              />
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function InstanceTree({
  onFocus,
  onSelect,
  onViewport,
  selectedKey,
  usage,
  viewport,
  viewports,
}: {
  /**
   * Receives the instance to point out when a nested list opens or closes:
   * the first nested instance of an opened list, or the instance whose list
   * closes.
   */
  onFocus?: ((key: string) => void) | undefined;
  /** Receives the key of each instance that the reader selects. */
  onSelect?: ((key: string) => void) | undefined;
  /** Receives each viewport that the reader chooses. */
  onViewport?: ((viewport: InstanceViewport) => void) | undefined;
  /** The key of the selected instance, whose button is pressed. */
  selectedKey?: string | undefined;
  usage: InstanceTreeUsage;
  /** The viewport whose instances show. */
  viewport: InstanceViewport;
  /**
   * The viewports to choose from, in their order, each with its stable key.
   * With fewer than two, the tab offers no choice.
   */
  viewports: readonly { key: string; viewport: InstanceViewport }[];
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return (
    <>
      {viewports.length > 1 ? (
        <div>
          {viewports.map((context) => (
            <button
              aria-pressed={context.viewport === viewport}
              className="mbk-instance-context mbk-chip"
              key={context.key}
              onClick={() => onViewport?.(context.viewport)}
              type="button"
            >
              {context.viewport === "mobile" ? "Mobile" : "Desktop"}
            </button>
          ))}
        </div>
      ) : null}
      {usage.status === "waiting" ? (
        <p role="status">{usage.text}</p>
      ) : usage.status === "unavailable" ? (
        <p>Component inspection is unavailable for this view.</p>
      ) : !usage.total ? (
        <p>No registered components are used in this view.</p>
      ) : (
        <>
          <p>
            {usage.total}
            {" instances ·"} {usage.components}
            {" components"}
          </p>
          <InstanceList
            expanded={expanded}
            instances={usage.instances}
            onExpanded={(key, open, child) => {
              setExpanded((current) => {
                const next = new Set(current);
                if (open) next.add(key);
                else next.delete(key);
                return next;
              });
              onFocus?.(open && child ? child : key);
            }}
            onSelect={onSelect}
            selectedKey={selectedKey}
          />
        </>
      )}
    </>
  );
}
