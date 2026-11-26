import type { Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { failWith } from "../api-responses";
import { buildDouble } from "../build-double";
import { routeBuilds } from "../build-routes";
import { expect, freshEmail, open, openDialog } from "../harness";
import { chooseRepository, createProject } from "../project-setup";
import { createToken, publish } from "../publish";

import type { Subject } from "./subject";
import { writes } from "./undoable-writes";
import { field } from "./write-steps";

/**
 * Every control the write-failure rule in `folio-chrome.md` covers, and how to
 * make its own write be refused. The rule names only its exceptions — a
 * refusal that changes what the reader does next is drawn as a state body —
 * so this list is the inventory, which is why a control that moves onto the
 * fragment is added here rather than to the protocol doc.
 *
 * The fragment puts the cause immediately above the control that made the
 * write and the reference beneath it, so the operation is named by the control
 * and the cause by the message. Six of these controls reported below their own
 * control instead, which is why the order is read from the document here rather
 * than trusted to each surface.
 *
 * Every undoable write is refused here too, because reaching its control and
 * giving it something to send is the same journey; the rows below it are the
 * controls with nothing to undo.
 */
export interface RefusedWrite {
  /** The control, named for the assertion that fails. */
  where: string;
  /** The control that made the write. */
  control: string;
  /** Put the reader in front of that control with its own write refused. */
  refuse: (page: Page, subject: Subject) => Promise<void>;
  /** A failure raised in the browser has no reference to disclose. */
  referenced?: false;
  /** What the control reads once its own write has been refused. */
  says: string;
}

export const refusals: readonly RefusedWrite[] = [
  ...writes.map((write) => ({
    where: write.where,
    control: write.control,
    says: "Try again",
    refuse: async (page: Page, subject: Subject) => {
      await write.visit(page, subject);
      await failWith(page, write.url, write.method, "unavailable");
      await write.give(page, subject);
      await page.getByTestId(write.control).click();
    },
  })),
  {
    where: "account/sign-out",
    says: "Try again",
    control: "sign-out",
    refuse: async (page, subject) => {
      await openDialog(page, `${subject.projectPath}?settings=account`);
      await failWith(page, "**/v1/session", "DELETE", "unavailable");
      await page.getByTestId("sign-out").click();
    },
  },
  {
    // The last setup step's own write. Its input is a repository chosen from
    // the installed list, so there is nothing to take back out again and it is
    // not an undoable write; what it reports is the same fragment.
    where: "account/create-project",
    says: "Try again",
    control: "create-project",
    refuse: async (page, subject) => {
      await open(page, `${subject.workspacePath}/-/new`);
      await chooseRepository(page);
      await failWith(
        page,
        "**/v1/workspaces/*/projects",
        "POST",
        "unavailable",
      );
      await page.getByTestId("create-project").click();
    },
  },
  {
    where: "members/revoke-invitation",
    says: "Try again",
    control: "revoke-invitation",
    refuse: async (page, subject) => {
      await openDialog(page, `${subject.projectPath}?settings=members`);
      await field(page, "Email").fill(freshEmail("withdrawn"));
      await page.getByTestId("send-invitation").click();
      const withdraw = page.getByTestId("revoke-invitation");
      await expect(withdraw).toBeVisible();
      await failWith(
        page,
        "**/v1/workspaces/*/members/*",
        "DELETE",
        "unavailable",
      );
      await withdraw.click();
    },
  },
  {
    // The entry screens' other write. `operation-unavailable` is the notice
    // those screens keep a composition of their own for, so the refusal here
    // is one the same request could answer.
    where: "sign-in/github-entry",
    says: "Try again",
    control: "github-entry",
    refuse: async (page) => {
      await open(page, "/sign-in");
      await failWith(page, "**/v1/auth/github", "POST", "unavailable");
      await page.getByTestId("github-entry").click();
    },
  },
  {
    // The project pane's switch writes on its own. Its control shows no label
    // to relabel, so what it says before and after is nothing at all; its
    // fragment still puts the cause above it and the reference beneath. The
    // suite's API cannot build, so the project read is answered as one that
    // can, which is what puts the switch on the pane.
    where: "project/automatic-builds",
    says: "",
    control: "automatic-builds",
    refuse: async (page, subject) => {
      await routeBuilds(
        page,
        subject.projectId,
        buildDouble({
          project: { buildsAvailable: true, automaticBuilds: false },
        }),
      );
      await openDialog(page, `${subject.projectPath}?settings=project`);
      const toggle = page.getByTestId("automatic-builds");
      await expect(toggle).toBeVisible();
      await failWith(page, "**/v1/projects/*", "PATCH", "unavailable");
      await toggle.click();
    },
  },
  {
    // A clipboard the browser refused was never a request Mokly answered, so
    // this one draws no reference. It goes after every row that still needs a
    // clipboard: the page it needs is the one whose clipboard has been taken
    // away for the rest of the run.
    where: "tokens/copy-token",
    says: "Copy token",
    control: "copy-token",
    referenced: false,
    refuse: async (page, subject) => {
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      });
      await openDialog(page, `${subject.projectPath}?settings=tokens`);
      await page.getByTestId("new-token").click();
      await field(page, "Token name").fill("Uncopyable token");
      await page.getByTestId("create-token").click();
      const copy = page.getByTestId("copy-token");
      await expect(copy).toBeVisible();
      await copy.click();
    },
  },
  {
    // The viewer draws the same fragment for the same reason, so its own
    // clipboard control is asserted here rather than beside the panel: what
    // the family promises is that every member of it says a refusal the same
    // way. It goes after the token reveal, whose init script has taken the
    // clipboard away for the rest of the run, and it publishes what it shares
    // into a project of the fixture's own repository — the subject's is named
    // after the suite, and an upload is admitted only for the repository the
    // project was created for.
    where: "share/share-copy",
    says: "Copy link",
    control: "share-copy",
    referenced: false,
    refuse: async (page) => {
      const projectId = await createProject(page, "Share Org");
      const token = await createToken(page, projectId);
      const made = await publish(token, projectId, { branch: "main" });
      await open(
        page,
        `${await publicationPathFor(page, projectId, made.id)}?panel=share`,
      );
      const copy = page.getByTestId("share-copy");
      await expect(copy).toBeVisible();
      await copy.click();
    },
  },
];
