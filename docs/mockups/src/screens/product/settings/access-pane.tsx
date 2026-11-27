import type { Viewport } from "@mokly/mokly";

import { ContentList } from "../../../entries/design/content-list.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference, membership } from "../../../fixtures/product-states";
import { Action, Pending, Section, StateMessage } from "../page-parts";

import { SettingsSurface } from "./surface";

/**
 * One waiting row of a list of people: a bar for the name, the address and
 * the role, each in its own line box, since the answer supplies all three.
 */
const waitingPerson = {
  id: "waiting",
  title: "",
  detail: "",
  meta: "",
  waiting: true,
};

function Grants({ state }: { state: ScreenState }) {
  return (
    <Section
      title="Project grants"
      description="Grants add access; they never reduce what the workspace allows."
    >
      {state === "empty" ? (
        <p className="fo-copy">No additional project grants.</p>
      ) : (
        <div className="fo-panel">
          <ContentList
            moklyInstance="project-grants"
            label="Project grants"
            rows={[
              state === "loading"
                ? waitingPerson
                : {
                    id: "sam",
                    title: membership.selected.name,
                    detail: membership.selected.email,
                    meta: "Reviewer",
                  },
            ]}
          />
        </div>
      )}
    </Section>
  );
}

/**
 * The access a project inherits and the grants it adds, under their headings.
 * While the grants are read, each list keeps its section and draws one
 * placeholder row, and Manage members, whose label is known, draws itself
 * disabled.
 */
function Access({ state }: { state: ScreenState }) {
  const waits = state === "loading";
  return (
    <div className="fo-stack">
      <Section
        title="From Mokly"
        description="Everyone in the workspace already has this access."
        action={
          <Action
            label="Manage members"
            to="product/settings/members"
            size="sm"
            disabled={waits}
          />
        }
      >
        <div className="fo-panel">
          <ContentList
            moklyInstance="inherited-access"
            label="Inherited workspace access"
            rows={
              waits
                ? [waitingPerson]
                : membership.active.map((person) => ({
                    id: person.email,
                    title: person.name,
                    // A person listed by their address has no second line.
                    // The registered list refuses an `undefined` value, so
                    // the row leaves the key out.
                    ...(person.name === person.email
                      ? {}
                      : { detail: person.email }),
                    meta: person.role,
                  }))
            }
          />
        </div>
      </Section>
      <Grants state={state} />
    </div>
  );
}

function AccessPane({
  state,
  viewport,
}: {
  state: ScreenState;
  viewport: Viewport;
}) {
  return (
    <SettingsSurface
      pane="access"
      state={state}
      viewport={viewport}
      title="Access"
    >
      {state === "loading" ? (
        <Pending label="Loading project access" labelMode="screen-reader-only">
          <Access state={state} />
        </Pending>
      ) : state === "error" ? (
        <StateMessage
          title="Access couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/access"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : (
        <Access state={state} />
      )}
    </SettingsSurface>
  );
}

export function SettingsAccessScreen({ viewport }: { viewport: Viewport }) {
  return <AccessPane viewport={viewport} state="default" />;
}

export function SettingsAccessEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccessPane viewport={viewport} state="empty" />;
}

export function SettingsAccessLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccessPane viewport={viewport} state="loading" />;
}

export function SettingsAccessErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <AccessPane viewport={viewport} state="error" />;
}
