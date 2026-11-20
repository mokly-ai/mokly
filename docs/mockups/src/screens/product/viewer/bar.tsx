import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import { Brand } from "../navigation";
import { Action } from "../page-parts";
import { ControlPlaceholder } from "../placeholders";

import { AccountTrigger, accountMenuPath } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";

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
  workspace,
  project,
}: {
  workspace: string;
  project: string;
}) {
  const label = workspace + " / " + project;
  return (
    <span className="fo-top-variable-control" title={label}>
      <Action
        instance="viewer-project"
        label={label}
        whole={label}
        tone="quiet"
        size="sm"
        chevron
        block
        singleLine
        to="product/viewer/projects"
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

/**
 * Share in the cloud's bar keeps the secondary tone: every stage it stands
 * over offers its own card, whose action is the screen's one filled action.
 */
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
      to={accountMenuPath}
      disabled={waiting}
    />
  );
}

/**
 * The fallback header: the Canvas composition of the ready bar around the
 * cloud's own mark, with no search, because no catalogue is mounted. The full
 * bar holds the project switcher, the publication pill, History, Share and
 * the account's avatar; the compact bar keeps the pill and groups the rest
 * under More, matching the package-slot composition. A phone draws the
 * compact bar only. A desktop drawing draws both in one row around its one
 * publication slot, which holds a reference trigger for each composition, and
 * the switch in `viewer.css` shows the parts of the composition that the
 * bar's own width holds. While the route reads the project, `waiting` draws
 * each control's waiting form: the project trigger's label is the project's,
 * so it is a placeholder, and History, Share, the account and More keep their
 * labels and are disabled. The caller passes the publication slot's own
 * waiting form.
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
  account: AccountLabel;
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
            <ProjectTrigger workspace={workspace} project={project} />
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
          <AccountTrigger
            account={account}
            to={accountMenuPath}
            disabled={waiting}
          />
        </span>
      </span>
      <span className="fo-top-fixed fo-compact-bar-only">
        <More waiting={waiting} />
      </span>
    </div>
  );
}
