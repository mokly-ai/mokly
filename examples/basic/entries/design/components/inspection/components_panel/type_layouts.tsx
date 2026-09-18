import { MockLink } from "@mokly/mokly";

import {
  childrenFor,
  componentGroups,
  countLabel,
  destinationFor,
  ownerFor,
  type WelcomeInstance,
} from "./model.js";

function GroupRow({ instance }: { instance: WelcomeInstance }) {
  const children = childrenFor(instance);
  return (
    <li>
      <MockLink
        aria-current={instance.id === "footer-action" ? "true" : undefined}
        className="ce-panel-group-row"
        data-instance-id={instance.id}
        to={destinationFor(instance)}
      >
        <strong>{instance.label}</strong>
        {instance.visible ? null : (
          <span className="ce-panel-status">Hidden</span>
        )}
        <small>{ownerFor(instance)}</small>
      </MockLink>
      {children.length ? (
        <p className="ce-panel-group-note">
          Contains{" "}
          {children
            .map((child) => `${child.component} · ${child.label}`)
            .join(", ")}
        </p>
      ) : instance.visible ? null : (
        <p className="ce-panel-group-note">No visible region</p>
      )}
    </li>
  );
}

export function ComponentIndex() {
  return (
    <div className="ce-panel-groups" aria-label="Component instances">
      {componentGroups.map((group) => (
        <details className="ce-panel-group" key={group.component} open>
          <summary>
            <span>{group.component}</span>
            <small>{countLabel(group.instances.length)}</small>
          </summary>
          <ul>
            {group.instances.map((instance) => (
              <GroupRow instance={instance} key={instance.id} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function LedgerRow({ instance }: { instance: WelcomeInstance }) {
  return (
    <li>
      <MockLink
        aria-current={instance.id === "footer-action" ? "true" : undefined}
        data-instance-id={instance.id}
        to={destinationFor(instance)}
      >
        <span className="ce-panel-ledger-instance">
          <strong>{instance.label}</strong>
          {instance.visible ? null : <small>No visible region</small>}
        </span>
        {instance.visible ? null : (
          <span className="ce-panel-status">Hidden</span>
        )}
        <span className="ce-panel-ledger-owner">{ownerFor(instance)}</span>
      </MockLink>
    </li>
  );
}

export function ComponentLedger() {
  return (
    <div className="ce-panel-ledger" aria-label="Component instances">
      <div className="ce-panel-ledger-head" aria-hidden="true">
        <span>Component</span>
        <span>Instance</span>
        <span>Inside</span>
      </div>
      {componentGroups.map((group) => (
        <section key={group.component} aria-label={group.component}>
          <h4>
            {group.component}
            <small>{countLabel(group.instances.length)}</small>
          </h4>
          <ul>
            {group.instances.map((instance) => (
              <LedgerRow instance={instance} key={instance.id} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
