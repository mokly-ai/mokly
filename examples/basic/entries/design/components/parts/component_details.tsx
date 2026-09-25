import { MockLink } from "@mokly/mokly";

import { MetaRow } from "../../parts/metadata_row.js";

import { ActionPropValues, actionVariants } from "./action_props.js";
import { ComparisonDetails } from "./comparison_details.js";
import { componentComparison } from "./comparison_fixtures.js";
import { ComponentInfo } from "./component_info.js";
import {
  AffectedScreens,
  UsageDeliveryState,
  UsedBy,
} from "./component_usage.js";
import { CONTROLS_PAGES } from "./destinations.js";
import { toolbarPrompt } from "./fixtures.js";
import { Inspector } from "./inspector.js";
import { COMPONENT_BY_STATE } from "./metadata.js";

export type ComponentPageState =
  | "default"
  | "disabled"
  | "comparison"
  | "affected"
  | "toolbar"
  | "hidden"
  | "unused"
  | "added"
  | "removed"
  | "usage-loading"
  | "usage-failed"
  | "closed";

function ComponentChildren() {
  return (
    <section>
      <h3>
        Nested components <span>1 instance</span>
      </h3>
      <MockLink to="design-component-overview">Action · Main action ↗</MockLink>
      <p className="ce-muted">1 instance · Default variant</p>
    </section>
  );
}

function ComponentProps({ state }: { state: ComponentPageState }) {
  return (
    <section>
      <h3>Supplied props</h3>
      {state === "toolbar" ||
      state === "hidden" ||
      state === "unused" ||
      state === "added" ? (
        <dl className="ce-props" aria-label="Supplied props">
          <MetaRow
            name="selected-prop"
            label={
              state === "toolbar"
                ? "prompt"
                : state === "hidden"
                  ? "visible"
                  : "label"
            }
            presentation="props"
          >
            <code>
              {state === "toolbar"
                ? `"${toolbarPrompt}"`
                : state === "hidden"
                  ? "false"
                  : '"New"'}
            </code>
          </MetaRow>
        </dl>
      ) : (
        <ActionPropValues
          props={
            actionVariants[state === "disabled" ? "disabled" : "default"].props
          }
        />
      )}
      {COMPONENT_BY_STATE[state] === "action" && state !== "removed" ? (
        <MockLink
          to={
            state === "disabled"
              ? CONTROLS_PAGES.variant
              : CONTROLS_PAGES.default
          }
        >
          Edit props ↗
        </MockLink>
      ) : null}
    </section>
  );
}

export function ComponentDetails({ state }: { state: ComponentPageState }) {
  const changed =
    state === "affected" || state === "comparison" || state === "removed";
  const usageDelivery =
    state === "usage-loading"
      ? "loading"
      : state === "usage-failed"
        ? "failed"
        : undefined;
  const initial =
    state === "closed"
      ? "closed"
      : changed || state === "unused" || usageDelivery
        ? "usage"
        : state === "disabled" || state === "hidden"
          ? "props"
          : "info";
  return (
    <Inspector
      initial={initial}
      panels={[
        {
          id: "info",
          label: "Details",
          content: (
            <>
              <ComponentInfo identity={COMPONENT_BY_STATE[state]} />
              <ComparisonDetails comparison={componentComparison(state)} />
            </>
          ),
        },
        ...(state === "toolbar"
          ? [
              {
                id: "components" as const,
                label: "Nested components",
                content: <ComponentChildren />,
              },
            ]
          : []),
        {
          id: "props",
          label: "Props",
          content: <ComponentProps state={state} />,
        },
        {
          id: "usage",
          label: "Usage",
          content: usageDelivery ? (
            <UsageDeliveryState state={usageDelivery} />
          ) : (
            <>
              <UsedBy state={state} />
              {changed ? (
                <AffectedScreens removed={state === "removed"} />
              ) : null}
            </>
          ),
        },
      ]}
    />
  );
}
