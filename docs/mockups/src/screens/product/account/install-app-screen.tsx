import type { Viewport } from "@mokly/mokly";

import { workspace } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { stateScreenPath } from "../../../fixtures/product-states";
import { Action, BackLink, ExternalLink, Facts, Pending } from "../page-parts";
import { ControlPlaceholder, TextBar } from "../placeholders";
import { AccountShell } from "./account-shell";
import { PublishWithCli } from "./cli-link";

/**
 * What the owner's and the admin's step draws: its four states, its write
 * while it leaves for GitHub, and the suspension while its link is read and
 * after that read failed.
 */
type Situation =
  ScreenState | "installing" | "suspended-loading" | "suspended-unreadable";

/** Where each situation beyond the four states is drawn. */
const situationPaths: Record<Exclude<Situation, ScreenState>, string> = {
  installing: "product/account/install-app/installing",
  "suspended-loading": "product/account/install-app/suspended-loading",
  "suspended-unreadable": "product/account/install-app/suspended-unreadable",
};

/** How far the read of the suspension's link has got. */
type LinkRead = "read" | "loading" | "failed";

/**
 * The suspension, the one fact a suspended step draws: the state, and the
 * link GitHub gives for clearing it. The link comes from a read of its own,
 * so while that read runs a placeholder holds the link's box, and a read that
 * failed says so where the link would be, with a quiet retry. The rest of the
 * step stays as it is.
 */
function Suspension({ link }: { link: LinkRead }) {
  return (
    <Facts
      ruled
      rows={[
        [
          "App",
          <span className="review-inline" key="installation">
            <span>{workspace.installationSuspended}</span>
            {link === "failed" ? (
              <>
                <span>Couldn’t load</span>
                <Action
                  label="Try again"
                  to="product/account/install-app/error"
                  tone="quiet"
                  size="sm"
                  icon="retry"
                />
              </>
            ) : link === "loading" ? (
              // The link's box takes the width; its bar fills it.
              <span
                className="fo-site-link"
                aria-hidden="true"
                style={{ width: "min(9.5em, 100%)" }}
              >
                <TextBar width="100%" />
              </span>
            ) : (
              <ExternalLink
                to={workspace.manageUrl}
                label="Resume on GitHub"
                newTab
              />
            )}
          </span>,
        ],
      ]}
    />
  );
}

/**
 * The step's one control and its way back. While the workspace read runs, the
 * reader's role decides whether the control is there at all, so it is a
 * placeholder in its own box. While its write runs it stays, busy, until the
 * page leaves for GitHub, and Back stays beside it.
 */
function InstallAction({ write }: { write: "rest" | "running" | "waiting" }) {
  return (
    <>
      <div className="fo-account-actions">
        {write === "waiting" ? (
          <ControlPlaceholder />
        ) : write === "running" ? (
          <Action
            label="Installing…"
            tone="primary"
            icon="github"
            block
            busy="Installing the Mokly app"
          />
        ) : (
          <Action
            label="Install on GitHub"
            to="product/account/choose-repository"
            tone="primary"
            icon="github"
            block
          />
        )}
      </div>
      <BackLink to="product/account/create-workspace" />
    </>
  );
}

/**
 * The second setup step, shown only while the workspace has nothing bound.
 * The reader's GitHub account is what the step exists to bind, so a fact
 * reading "Not connected" would name the absence the one action removes: the
 * default and empty pages are the same drawing, because a step with nothing
 * bound has no emptier one. The error is the suspension, which only GitHub
 * clears, so it draws the fact and its link above the same action. While the
 * workspace is read, the step draws the owner's and the admin's form, because
 * the person who creates a workspace owns it, and names the read in the line
 * under the title.
 */
function InstallAppPage({ situation }: { situation: Situation }) {
  const id =
    situation === "default" ||
    situation === "empty" ||
    situation === "loading" ||
    situation === "error"
      ? stateScreenPath("product/account/install-app", situation)
      : situationPaths[situation];
  if (situation === "loading")
    return (
      <AccountShell
        id={id}
        title="Install the Mokly app"
        identity={{ kind: "signed-in" }}
        step={2}
        wait="Loading your workspace"
        detail={(name) => name}
        below={<PublishWithCli waiting />}
      >
        <InstallAction write="waiting" />
      </AccountShell>
    );
  const link: LinkRead | undefined =
    situation === "error"
      ? "read"
      : situation === "suspended-loading"
        ? "loading"
        : situation === "suspended-unreadable"
          ? "failed"
          : undefined;
  return (
    <AccountShell
      id={id}
      title="Install the Mokly app"
      detail="Choose the repositories Mokly can read."
      identity={{ kind: "signed-in" }}
      step={2}
      below={<PublishWithCli installation={link ? "suspended" : "absent"} />}
    >
      {link === "loading" ? (
        // Only the link waits, so only the fact is the waiting region.
        <Pending
          label="Loading GitHub installation"
          labelMode="screen-reader-only"
        >
          <Suspension link={link} />
        </Pending>
      ) : (
        link && <Suspension link={link} />
      )}
      <InstallAction write={situation === "installing" ? "running" : "rest"} />
    </AccountShell>
  );
}

export function InstallAppScreen(_props: { viewport: Viewport }) {
  return <InstallAppPage situation="default" />;
}

export function InstallAppEmptyScreen(_props: { viewport: Viewport }) {
  return <InstallAppPage situation="empty" />;
}

/** The workspace read: the owner's and the admin's step in waiting form. */
export function InstallAppLoadingScreen(_props: { viewport: Viewport }) {
  return <InstallAppPage situation="loading" />;
}

export function InstallAppErrorScreen(_props: { viewport: Viewport }) {
  return <InstallAppPage situation="error" />;
}

/** Install on GitHub's write, busy until the page leaves for GitHub. */
export function InstallAppInstallingScreen(_props: { viewport: Viewport }) {
  return <InstallAppPage situation="installing" />;
}

/** The suspension while the installation list that holds its link is read. */
export function InstallAppSuspendedLoadingScreen(_props: {
  viewport: Viewport;
}) {
  return <InstallAppPage situation="suspended-loading" />;
}

/** The suspension when its link could not be read, with the way to read it. */
export function InstallAppSuspendedUnreadableScreen(_props: {
  viewport: Viewport;
}) {
  return <InstallAppPage situation="suspended-unreadable" />;
}

/**
 * The same step read by a member, who can create projects but cannot install
 * the App: one line says who can, and the step keeps its way back and its way
 * round the App, so the reader is never left with nothing to do.
 */
export function InstallAppMemberScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/install-app/member"
      title="Install the Mokly app"
      detail="Ask an owner or admin to install it."
      identity={{ kind: "signed-in" }}
      step={2}
      below={<PublishWithCli installation="absent" />}
    >
      <BackLink to="product/account/create-workspace" />
    </AccountShell>
  );
}

/**
 * The same step read by a reviewer, who can create no project at all: the
 * title says what the workspace holds and the line says who changes it. A
 * reviewer has no project to publish, so the way round the App is not offered.
 */
export function InstallAppReviewerScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/install-app/reviewer"
      title="No projects yet"
      detail="Ask an owner or admin to create the first project."
      identity={{ kind: "signed-in" }}
      step={2}
    >
      <BackLink to="product/account/create-workspace" />
    </AccountShell>
  );
}
