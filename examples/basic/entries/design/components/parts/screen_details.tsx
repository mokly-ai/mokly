import { MockLink } from "@mokly/mokly";

import { ComparisonDetails } from "./comparison_details.js";
import { screenComparison } from "./comparison_fixtures.js";
import { welcomeInstances } from "./fixtures.js";
import { Inspector, type InspectorPanel } from "./inspector.js";
import { InstanceDetails } from "./instance_details.js";
import { InstanceTree } from "./instance_tree.js";
import { SCREENS, screenIdentity } from "./metadata.js";
import type { ScreenPageState } from "./screen_preview.js";

function ScreenComponents({ state }: { state: ScreenPageState }) {
  const loading = state === "inspection-loading";
  const unavailable = state === "unavailable";
  const empty = state === "empty";
  const consumer = state === "consumer";
  return (
    <section className="ce-usage-section" aria-label="Components in this view">
      <h3>
        Components{" "}
        {loading ? null : (
          <span>
            {unavailable
              ? "Unavailable"
              : empty
                ? "0"
                : consumer
                  ? "1 instance"
                  : `${welcomeInstances.length} instances`}
          </span>
        )}
      </h3>
      {loading ? (
        <p className="ce-empty-copy" role="status">
          Waiting for the component preview.
        </p>
      ) : empty || unavailable ? (
        <p className="ce-empty-copy">
          {unavailable
            ? "Component inspection is unavailable for this screen."
            : "No registered components are used in this view."}
        </p>
      ) : consumer ? (
        <MockLink to="design-component-overview">Action · Continue ↗</MockLink>
      ) : (
        <InstanceTree state={state} />
      )}
    </section>
  );
}

function ScreenUsage({ state }: { state: ScreenPageState }) {
  const components =
    state === "consumer"
      ? ["Action"]
      : [...new Set(welcomeInstances.map((instance) => instance.component))];
  return (
    <section>
      <h3>Component pages</h3>
      <p className="ce-muted">Explore the components used by this screen.</p>
      <ul className="ce-usage-list">
        {components.map((component) => (
          <li key={component}>
            <MockLink
              to={
                component === "Toolbar"
                  ? "design-component-toolbar"
                  : component === "Help hint"
                    ? "design-component-help"
                    : "design-component-overview"
              }
            >
              {component}
              <span aria-hidden="true">↗</span>
            </MockLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ScreenDetails({ state }: { state: ScreenPageState }) {
  const screen = SCREENS[screenIdentity(state)];
  const removed = state === "removed-consumer";
  const loading = state === "inspection-loading";
  const noInstances = state === "empty" || state === "unavailable" || loading;
  const initial =
    state === "closed" || removed
      ? "closed"
      : noInstances || state === "highlight"
        ? "components"
        : "props";
  return (
    <Inspector
      initial={initial}
      panels={[
        {
          id: "info",
          label: "Details",
          content: (
            <>
              <section>
                <h3>About {screen.title}</h3>
                <p>{screen.description}</p>
                <p className="ce-muted">
                  Source <code>{screen.source}</code>
                </p>
              </section>
              <ComparisonDetails comparison={screenComparison(state)} />
            </>
          ),
        },
        ...(removed
          ? []
          : ([
              {
                id: "components",
                label: "Components",
                content: <ScreenComponents state={state} />,
              },
              {
                id: "props",
                label: "Props",
                content: noInstances ? (
                  <p className="ce-empty-copy">
                    {loading
                      ? "Waiting for the component preview."
                      : state === "unavailable"
                        ? "Props are unavailable for this screen."
                        : "Select a component to see its supplied props."}
                  </p>
                ) : (
                  <InstanceDetails state={state} />
                ),
              },
              {
                id: "usage",
                label: "Usage",
                content: noInstances ? (
                  <p className="ce-empty-copy">
                    {loading
                      ? "Loading usage…"
                      : state === "unavailable"
                        ? "Usage is unavailable until the catalogue has been checked."
                        : "This screen uses no registered components."}
                  </p>
                ) : (
                  <ScreenUsage state={state} />
                ),
              },
            ] satisfies InspectorPanel[])),
      ]}
    />
  );
}
