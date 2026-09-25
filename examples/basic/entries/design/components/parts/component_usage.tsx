import { MockLink } from "@mokly/mokly";

import type { ComponentPageState } from "./component_details.js";
import { componentUses, usageViews } from "./fixtures.js";

export function UsageDeliveryState({ state }: { state: "loading" | "failed" }) {
  return (
    <section className="ce-usage-state" aria-label="Usage status">
      {state === "loading" ? (
        <p className="ce-empty-copy" role="status">
          Loading usage…
        </p>
      ) : (
        <>
          <p className="ce-empty-copy" role="alert">
            Usage couldn’t be loaded.
          </p>
          <button className="ce-text-button" type="button">
            Try again
          </button>
        </>
      )}
    </section>
  );
}

export function UsedBy({ state }: { state: ComponentPageState }) {
  const unused = state === "unused" || state === "added";
  const uses =
    state === "toolbar" || state === "hidden"
      ? componentUses.slice(0, 1)
      : componentUses;
  const screens = uses.filter((use) => use.kind === "screen");
  const components = uses.filter((use) => use.kind === "component");
  return (
    <section className="ce-usage-section" aria-label="Used by">
      <h3>
        Used by{" "}
        <span>
          {unused
            ? "0"
            : `${screens.length} ${screens.length === 1 ? "screen" : "screens"}${components.length ? ` · ${components.length} component` : ""}`}
        </span>
      </h3>
      {unused ? (
        <p className="ce-empty-copy">No screens or components use Badge yet.</p>
      ) : (
        <ul className="ce-usage-list">
          {uses.map((use) => (
            <li key={use.title}>
              <MockLink
                to={
                  state === "toolbar"
                    ? "design-component-inspection-toolbar"
                    : state === "hidden"
                      ? "design-component-inspection-help"
                      : use.to
                }
              >
                {use.title}
                <span aria-hidden="true">↗</span>
              </MockLink>
              <span>
                {state === "toolbar" || state === "hidden"
                  ? "1 instance · Direct"
                  : `${use.count} ${use.count === 1 ? "instance" : "instances"} · ${use.via}`}{" "}
                · {usageViews.length} views
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AffectedScreens({ removed }: { removed: boolean }) {
  const screens = componentUses.filter((use) => use.kind === "screen");
  return (
    <section className="ce-affected" aria-label="Affected screens">
      <h3>
        Affected screens <span>{screens.length + (removed ? 1 : 0)}</span>
      </h3>
      <p>
        {removed
          ? "Current screens use Action. Former screens stay available to compare."
          : "These screens use Action. Their own content and props are unchanged."}
      </p>
      <ul className="ce-usage-list">
        {screens.map((use) => (
          <li key={use.title}>
            <MockLink to={use.to}>
              {use.title}
              <span aria-hidden="true">↗</span>
            </MockLink>
            <span>
              {use.via} · {use.count}{" "}
              {use.count === 1 ? "instance" : "instances"}
            </span>
          </li>
        ))}
        {removed ? (
          <li>
            <MockLink to="design-component-removed-consumer">
              Farewell <span>Removed</span>
            </MockLink>
            <span>Previously used the Compact variant</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
