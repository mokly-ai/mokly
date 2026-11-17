/**
 * The writes of the account family: sign in, sign up and Check your email send
 * a sign-in link, sign in and sign up connect GitHub, and the onboarding steps
 * create a workspace, create a project with the CLI, install the App and
 * connect an installation. While a write runs, the pressed control carries the
 * wait, as Write in progress in `folio-chrome.md` defines. The form inserts
 * nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { onboarding } from "../fixtures/product-states";
import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import { actions, busyActions, drawnPage, pendingLabels } from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

/**
 * Each write: its page at rest and while it runs, the control that sends it
 * with the working word it then shows, what screen readers hear, and what the
 * reader typed, which stays.
 */
const writes = [
  {
    resting: "product/account/sign-in",
    running: "product/account/sign-in/loading",
    control: "Continue with email",
    working: "Sending…",
    heard: "Sending sign-in link…",
    typed: [onboarding.email],
  },
  {
    resting: "product/account/sign-up",
    running: "product/account/sign-up/loading",
    control: "Continue with email",
    working: "Sending…",
    heard: "Sending sign-in link…",
    typed: [onboarding.email],
  },
  {
    resting: "product/account/sign-in",
    running: "product/account/sign-in/github-connecting",
    control: "Continue with GitHub",
    working: "Connecting…",
    heard: "Connecting to GitHub…",
    typed: [onboarding.email],
  },
  {
    resting: "product/account/sign-up",
    running: "product/account/sign-up/github-connecting",
    control: "Continue with GitHub",
    working: "Connecting…",
    heard: "Connecting to GitHub…",
    typed: [onboarding.email],
  },
  {
    resting: "product/account/magic-link",
    running: "product/account/magic-link/loading",
    control: "Resend link",
    working: "Sending…",
    heard: "Sending sign-in link…",
    typed: [onboarding.email],
  },
  {
    resting: "product/account/create-workspace",
    running: "product/account/create-workspace/creating",
    control: "Create workspace",
    working: "Creating…",
    heard: "Creating workspace…",
    typed: [onboarding.workspace, onboarding.workspaceSlug],
  },
  {
    resting: "product/account/choose-repository",
    running: "product/account/choose-repository/creating",
    control: "Create project",
    working: "Creating…",
    heard: "Creating project…",
    typed: [onboarding.config, onboarding.projectSlug],
  },
  {
    resting: "product/account/choose-repository/cli",
    running: "product/account/choose-repository/cli/loading",
    control: "Create project",
    working: "Creating…",
    heard: "Creating project…",
    typed: [onboarding.cliRepository, onboarding.cliProjectSlug],
  },
  {
    resting: "product/account/install-app",
    running: "product/account/install-app/installing",
    control: "Install on GitHub",
    working: "Installing…",
    heard: "Installing the Mokly app…",
    typed: [],
  },
  {
    resting: "product/account/install-app/connect",
    running: "product/account/install-app/connect/connecting",
    control: "Continue on GitHub",
    working: "Connecting…",
    heard: "Connecting a GitHub account…",
    typed: [onboarding.workspace],
  },
] as const;

/** Every link on the page, as its text and where it leads. */
function pageLinks(page: DrawnPage): [string, string][] {
  return elements(page.main, (element) => element.tagName === "a").map(
    (link) => [
      label(link),
      attribute(link, "data-mokly-link") ?? attribute(link, "href") ?? "",
    ],
  );
}

test("an account write keeps its form and holds only the pressed control busy", () => {
  for (const viewport of viewports)
    for (const write of writes) {
      const where = write.running + " " + viewport;
      const canonical = drawnPage(write.resting, viewport);
      const sending = drawnPage(write.running, viewport);
      // The same controls in the same order: only the pressed one changed,
      // and it shows its working word.
      assert.deepEqual(
        actions(sending),
        actions(canonical).map(([tone, name]) => [
          tone,
          name === write.control ? write.working : name,
        ]),
        where,
      );
      assert.deepEqual(busyActions(sending), [write.working], where);
      assert.deepEqual(busyActions(canonical), [], where);
      // The control already says it on screen, so the operation is heard only.
      assert.deepEqual(
        pendingLabels(sending),
        [[write.heard, "screen-reader-only"]],
        where,
      );
      // Nothing is inserted beside the control.
      assert.deepEqual(byClass(sending.main, "fo-pending"), [], where);
      assert.deepEqual(byClass(sending.main, "fo-wait"), [], where);
      // What the reader typed, the line under the title and the line under
      // the panel stay where they were, and so does every way on but the
      // pressed control, which leads nowhere while it works.
      for (const value of write.typed)
        assert.ok(sending.html.includes(value), where + " " + value);
      for (const line of ["fo-account-detail", "fo-account-switch"])
        assert.deepEqual(
          byClass(sending.main, line).map(label),
          byClass(canonical.main, line).map(label),
          where + " " + line,
        );
      assert.deepEqual(
        pageLinks(sending),
        pageLinks(canonical).filter(([name]) => name !== write.control),
        where,
      );
    }
});
