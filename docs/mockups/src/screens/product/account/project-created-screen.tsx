import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { addresses, sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  billing,
  failureReference,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { site } from "../../../fixtures/site";
import { Action, Facts, SiteLink, StateMessage } from "../page-parts";
import { ControlPlaceholder, factPlaceholder } from "../placeholders";
import { AccountShell } from "./account-shell";

/** The default branch the project's first build publishes. */
const defaultBranch = builds.setup.reference.name;

/** The facts the finished project is set up from, or their waiting form. */
function ProjectFacts({ waits }: { waits: boolean }) {
  return (
    <Facts
      ruled
      rows={
        waits
          ? [
              factPlaceholder("Address", "16em"),
              factPlaceholder("Repository", "11em"),
              factPlaceholder("Config", "10em"),
              factPlaceholder("Visibility", "3.5em"),
            ]
          : [
              ["Address", addresses.project],
              ["Repository", sample.repository],
              ["Config", <code key="config">{sample.config}</code>],
              ["Visibility", billing.publicVisibility],
            ]
      }
    />
  );
}

/**
 * The finished project: what it publishes from, and the way into it. The route
 * resolves one project and returns a reader who cannot open it to `/dashboard`,
 * and reads the default branch's row. When creation scheduled the branch's
 * first build, Open project leads to the viewer where it runs and the CI guide
 * stays the other way; when nothing is publishing, the guide leads. While the
 * project and its branch are read, the facts wait and the branch decides which
 * controls there are, so two placeholders hold their boxes.
 */
function ProjectCreatedBody({ state }: { state: ScreenState }) {
  if (state === "error")
    return (
      <>
        <StateMessage
          title="This project couldn’t load"
          error
          reference={failureReference}
        />
        <div className="fo-account-actions">
          <Action
            label="Try again"
            to="product/account/project-created"
            tone="primary"
            icon="retry"
            block
          />
        </div>
      </>
    );
  return (
    <>
      <ProjectFacts waits={state === "loading"} />
      {state === "loading" ? (
        <div className="fo-account-actions">
          <ControlPlaceholder />
          <ControlPlaceholder />
        </div>
      ) : state === "empty" ? (
        <div className="fo-account-actions">
          <Action
            instance="project-created-guide"
            label="Publish from CI"
            tone="primary"
            icon="external"
            block
          />
          <Action
            label="Open project"
            to="product/viewer/standalone/empty"
            tone="secondary"
            block
          />
        </div>
      ) : (
        <div className="fo-account-actions">
          <Action
            label="Open project"
            to="product/viewer/standalone/publish/publishing"
            tone="primary"
            block
          />
        </div>
      )}
    </>
  );
}

/**
 * The finished project's panel. While the project is read, its title is the
 * project's name, which the answer decides, so the heading holds a bar of its
 * line height, and screen readers hear the heading name the read.
 */
function ProjectCreatedPage({ state }: { state: ScreenState }) {
  return (
    <AccountShell
      id={stateScreenPath("product/account/project-created", state)}
      title={
        state === "loading"
          ? { bar: "min(10em, 100%)" }
          : state === "error"
            ? "Project setup"
            : sample.project + " is ready"
      }
      detail={
        state === "default"
          ? "Mokly is publishing " + defaultBranch + "."
          : undefined
      }
      identity={{ kind: "signed-in" }}
      wait={state === "loading" ? "Opening your project" : undefined}
      below={
        state === "default" ? (
          <p className="fo-account-switch">
            <SiteLink href={site.publishFromCi} label="Publish from CI" />
          </p>
        ) : undefined
      }
    >
      <ProjectCreatedBody state={state} />
    </AccountShell>
  );
}

export function ProjectCreatedScreen(_props: { viewport: Viewport }) {
  return <ProjectCreatedPage state="default" />;
}

export function ProjectCreatedEmptyScreen(_props: { viewport: Viewport }) {
  return <ProjectCreatedPage state="empty" />;
}

/** The project and its branch read: the panel in waiting form. */
export function ProjectCreatedLoadingScreen(_props: { viewport: Viewport }) {
  return <ProjectCreatedPage state="loading" />;
}

export function ProjectCreatedErrorScreen(_props: { viewport: Viewport }) {
  return <ProjectCreatedPage state="error" />;
}
