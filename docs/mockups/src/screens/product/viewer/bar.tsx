import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import { Brand } from "../navigation";
import { Action } from "../page-parts";
import { ControlPlaceholder } from "../placeholders";
import type { PublishedAccountLabel } from "./published-slots";

/**
 * The cloud-owned fallback header shown before the package can mount, and its
 * waiting form while the route reads the project. Waiting, a control whose
 * label the project decides draws a placeholder over its own box, and a
 * control whose label is known draws itself, disabled, as the Wait
 * composition in `folio-chrome.md` defines.
 */

/** The width of the workspace and project trigger, at the bar's size, in px. */
const projectTriggerWidth = 200;

function ProjectTrigger({
  viewport,
  workspace,
  project,
}: {
  viewport: Viewport;
  workspace: string;
  project: string;
}) {
  const label = viewport === "mobile" ? project : workspace + " / " + project;
  return (
    <span className="fo-top-variable-control" title={label}>
      <Action
        instance="viewer-project"
        label={label}
        whole={label}
        tone="secondary"
        size="sm"
        chevron
        block
        to="product/viewer/projects"
      />
    </span>
  );
}

function Settings({ waiting }: { waiting: boolean }) {
  return (
    <Action
      instance="viewer-settings"
      label="Settings"
      tone="quiet"
      size="sm"
      to="product/settings/sections"
      disabled={waiting}
    />
  );
}

function AccountTrigger({
  account,
  waiting,
}: {
  account: PublishedAccountLabel;
  waiting: boolean;
}) {
  return (
    <span className="fo-top-slot fo-top-account" title={account.whole}>
      <Action
        instance="viewer-account"
        label={account.label}
        whole={account.whole}
        tone="quiet"
        size="sm"
        chevron
        block
        to="product/settings/account"
        disabled={waiting}
      />
    </span>
  );
}

function History({ waiting }: { waiting: boolean }) {
  return (
    <Action
      instance="viewer-history"
      label="History"
      tone="quiet"
      size="sm"
      to="product/viewer/history"
      disabled={waiting}
    />
  );
}

function Share({ waiting }: { waiting: boolean }) {
  return (
    <Action
      instance="viewer-share"
      label="Share"
      tone="secondary"
      size="sm"
      to="product/viewer/share"
      disabled={waiting}
    />
  );
}

function More({ waiting }: { waiting: boolean }) {
  return (
    <Action
      instance="viewer-more"
      label="More"
      tone="quiet"
      size="sm"
      chevron
      disabled={waiting}
    />
  );
}

/**
 * The fallback header. The full bar keeps all six actions; the compact bar
 * keeps the publication and groups the other five under More, matching the
 * package-slot composition. A phone draws the compact bar only. A desktop
 * drawing draws both in one row around its one publication slot, which holds
 * a reference trigger for each composition, and the switch in `viewer.css`
 * shows the parts of the composition that the bar's own width holds. While
 * the route reads the project, `waiting` draws each control's waiting form:
 * the project trigger's label is the project's, so it is a placeholder, and
 * History, Share, Settings, the account and More keep their labels and are
 * disabled. The caller passes the publication slot's own waiting form.
 */
export function ViewerBar({
  viewport,
  publication,
  account,
  workspace,
  project,
  waiting = false,
}: {
  viewport: Viewport;
  publication: ReactNode;
  account: PublishedAccountLabel;
  workspace: string;
  project: string;
  waiting?: boolean;
}) {
  if (viewport === "mobile")
    return (
      <div className="fo-top-bar">
        <Brand compact />
        <span className="fo-top-slot fo-top-grow fo-compact-publication">
          {publication}
        </span>
        <More waiting={waiting} />
      </div>
    );
  return (
    <div className="fo-top-bar">
      <span className="fo-top-slot fo-top-leading">
        <Brand compact />
        <span className="fo-top-project fo-full-bar-only">
          {waiting ? (
            <ControlPlaceholder size="sm" width={projectTriggerWidth} />
          ) : (
            <ProjectTrigger
              viewport={viewport}
              workspace={workspace}
              project={project}
            />
          )}
        </span>
      </span>
      <span className="fo-top-slot fo-top-grow fo-full-bar-state">
        {publication}
      </span>
      <span className="fo-top-slot fo-top-trail fo-full-bar-only">
        <span className="fo-top-fixed">
          <History waiting={waiting} />
        </span>
        <span className="fo-top-fixed">
          <Share waiting={waiting} />
        </span>
        <span className="fo-top-fixed">
          <Settings waiting={waiting} />
        </span>
        <AccountTrigger account={account} waiting={waiting} />
      </span>
      <span className="fo-top-fixed fo-compact-bar-only">
        <More waiting={waiting} />
      </span>
    </div>
  );
}
