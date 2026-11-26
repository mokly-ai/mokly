import type { Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { failWith } from "../api-responses";
import { expect, open } from "../harness";
import { chooseRepository, createProject } from "../project-setup";
import { createToken, publish } from "../publish";

import { walks } from "./covered-writes";
import type { Subject } from "./subject";
import { writes } from "./undoable-writes";

/**
 * Controls the write-failure rule in `folio-chrome.md` covers, and how to make
 * each one's own write be refused. A row leaves this table under the rule in
 * `covered-writes.ts`: only when a named test fails on a break of that
 * control's own refusal, and never as the last row of its pane or screen. The
 * rule names only its exceptions — a refusal that changes what the reader does
 * next is drawn as a state body — so a surface that starts to draw the
 * fragment adds a row here rather than to the protocol doc.
 *
 * The fragment puts the cause immediately above the control that made the
 * write and the reference beneath it, so the operation is named by the control
 * and the cause by the message. Six of these controls reported below their own
 * control instead, which is why the order is read from the document here rather
 * than trusted to each surface.
 *
 * The undoable writes are refused here too, because reaching the control and
 * giving it something to send is the same journey, except those that
 * `covered-writes.ts` names; the rows below them are controls with nothing to
 * undo.
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
  ...writes.filter(walks("refusal")).map((write) => ({
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
    // The viewer draws the same fragment for the same reason, so its own
    // clipboard control is asserted here rather than beside the panel: what
    // the family promises is that every member of it says a refusal the same
    // way. A clipboard the browser refused was never a request Mokly
    // answered, so it draws no reference. It goes last, because its init
    // script takes the clipboard away for the rest of the run, and it
    // publishes what it shares into a project of the fixture's own
    // repository — the subject's is named after the suite, and an upload is
    // admitted only for the repository the project was created for.
    where: "share/share-copy",
    says: "Copy link",
    control: "share-copy",
    referenced: false,
    refuse: async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      });
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
