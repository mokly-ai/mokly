import { MockLink } from "@mokly/mokly";

import {
  childrenFor,
  componentGroups,
  countFor,
  destinationFor,
  locationFor,
  ordinalFor,
  rootInstances,
  type WelcomeInstance,
} from "./model.js";

function TreeRow({
  instance,
  nested = false,
}: {
  instance: WelcomeInstance;
  nested?: boolean;
}) {
  const count = countFor(instance);
  return (
    <MockLink
      aria-current={instance.id === "footer-action" ? "true" : undefined}
      className="ce-panel-tree-row"
      data-instance-id={instance.id}
      to={destinationFor(instance)}
    >
      <span className="ce-panel-tree-name">
        {instance.component} · <strong>{instance.label}</strong>
      </span>
      {instance.visible ? (
        count > 1 ? (
          <span className="ce-panel-tree-meta">
            {ordinalFor(instance)} of {count}
          </span>
        ) : null
      ) : (
        <span className="ce-panel-status">Hidden</span>
      )}
      <small>
        {locationFor(instance)}
        {instance.visible ? null : " · No visible region"}
      </small>
      {nested ? (
        <span className="ce-panel-tree-rail" aria-hidden="true" />
      ) : null}
    </MockLink>
  );
}

export function RenderTree() {
  return (
    <ul className="ce-panel-tree" aria-label="Component instances">
      {rootInstances.map((instance) => {
        const children = childrenFor(instance);
        return (
          <li key={instance.id}>
            <TreeRow instance={instance} />
            {children.length ? (
              <details className="ce-panel-tree-children">
                <summary>
                  {children.length} nested{" "}
                  {children.length === 1 ? "instance" : "instances"}
                </summary>
                <ul>
                  {children.map((child) => (
                    <li key={child.id}>
                      <TreeRow instance={child} nested />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function OwnershipOutline() {
  return (
    <div className="ce-panel-outline">
      <ul className="ce-panel-type-summary" aria-label="Component counts">
        {componentGroups.map((group) => (
          <li key={group.component}>
            {group.component} <span>{group.instances.length}</span>
          </li>
        ))}
      </ul>
      <ul className="ce-panel-tree" aria-label="Component ownership">
        {rootInstances.map((instance) => {
          const children = childrenFor(instance);
          return (
            <li key={instance.id}>
              <TreeRow instance={instance} />
              {children.length ? (
                <details className="ce-panel-outline-children" open>
                  <summary>
                    {children.length} nested{" "}
                    {children.length === 1 ? "instance" : "instances"}
                  </summary>
                  <ul>
                    {children.map((child) => (
                      <li key={child.id}>
                        <TreeRow instance={child} nested />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
