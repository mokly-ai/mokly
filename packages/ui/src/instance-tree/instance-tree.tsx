/**
 * The Components tab of a workspace: the component instances that the shown
 * view records, as a tree in which an instance lists the instances nested in
 * it under a disclosure. A reader selects an instance with its button. When
 * the workspace shows two viewports, a choice of viewport comes first.
 */

import { useState } from "react";

import { count } from "../count/count.js";

/** One recorded component instance, with the instances nested in it. */
export interface InstanceNode {
  /** The instance's stable key, which its button carries in `data-instance-key`. */
  key: string;
  /** The instance's own id in the view. */
  id: string;
  /** The title of the instance's component, or its component id. */
  title: string;
  nested: readonly InstanceNode[];
  /**
   * The address that the instance of a static depiction opens, such as the
   * document that shows it selected. The instance is then a link.
   */
  href?: string | undefined;
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
          {instance.href === undefined ? (
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
          ) : (
            <a
              aria-current={selectedKey === instance.key ? "true" : undefined}
              className="mbk-instance-select"
              data-instance-key={instance.key}
              href={instance.href}
            >
              {instance.title}
              {` · ${instance.id}`}
            </a>
          )}
          {instance.nested.length ? (
            <details
              onToggle={(event) => {
                const open = event.currentTarget.open;
                if (open === expanded.has(instance.key)) return;
                onExpanded(instance.key, open, instance.nested[0]?.key);
              }}
              open={expanded.has(instance.key)}
            >
              <summary>
                {count(instance.nested.length, "nested instance")}
              </summary>
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
  initiallyExpanded = [],
  onFocus,
  onSelect,
  onViewport,
  selectedKey,
  usage,
  viewport,
  viewports,
}: {
  /**
   * The keys of the instances whose nested lists start open, for a static
   * depiction that runs no script.
   */
  initiallyExpanded?: readonly string[] | undefined;
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(initiallyExpanded),
  );
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
            {`${count(usage.total, "instance")} · ${count(usage.components, "component")}`}
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
