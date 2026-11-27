import { expect, test } from "@playwright/test";

import {
  billing,
  causes,
  failureReference,
  fieldRefusals,
  onboarding,
  previewPassword,
} from "../fixtures/product-states";

import { productRun, productSchemes, productViewports } from "./product-runs";

/**
 * Every refused write that a product page draws: the cause, the way back and
 * the reference of the write-failure fragment, beside the control that sent
 * the request.
 */

/**
 * Where the drawn fragment put the cause and the reference, read back from the
 * document: what a screen meant to compose is what drifts. The way back is
 * found by its test id rather than its tag, because a control that navigates
 * is an anchor and one that submits is a button, and a screen may wrap either.
 */
function failureOrder() {
  const fragment = document.querySelector(".fo-write-failure");
  const precedes = (first: Element | null, second: Element | null) =>
    first !== null &&
    second !== null &&
    (first.compareDocumentPosition(second) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
      0;
  const control =
    fragment?.querySelector('[data-testid^="firna-button"]') ?? null;
  return {
    fragments: document.querySelectorAll(".fo-write-failure").length,
    causeAbove: precedes(
      fragment?.querySelector('[role="alert"]') ?? null,
      control,
    ),
    references: fragment?.querySelectorAll("details").length ?? 0,
    detailsBelow: precedes(control, fragment?.querySelector("details") ?? null),
  };
}

/** One page that draws the registered failure fragment, and what it says. */
interface DrawnRefusal {
  /** The screen or variant that draws it. */
  id: string;
  /**
   * The sentence the fragment announces, from the fixtures the app owns, or
   * nothing when the field owns the cause and has already said it.
   */
  cause?: string;
  /** What the way back reads, which is the first control inside the fragment. */
  back: string;
  /** Whether Mokly answered the request, so there is a reference to disclose. */
  reference: boolean;
  /** Whether this form's own address must come back retained and unmarked. */
  address?: boolean;
  /** What a control on the page that sent nothing still reads, when it has one. */
  resting?: string;
  /** The sentence this form's own field draws, when the address was refused. */
  marks?: string;
  /**
   * Sign in's Password field: the password it keeps, and the sentence it
   * draws when the password itself was refused.
   */
  password?: { kept: string; marks?: string };
}

/**
 * What a refused save says wherever Mokly answered it: the cause its shared
 * fixture owns, the way back the fragment gives it, and a reference to quote.
 * Most drawn refusals are exactly this, so each names only what it adds, and
 * one that differs states itself in full.
 */
const refusedSave = {
  cause: causes.busy,
  back: "Try again",
  reference: true,
} as const;

/**
 * Every page that draws the fragment, in one table rather than one test each.
 * A screen that starts drawing a refusal is then covered by the same
 * properties by construction, and a fragment that loses its shape fails on
 * every page that composes it instead of only where someone thought to look.
 */
const refusals: DrawnRefusal[] = [
  { ...refusedSave, id: "product/account/create-workspace/error" },
  { ...refusedSave, id: "product/account/sign-in/error", address: true },
  { ...refusedSave, id: "product/account/sign-up/error", address: true },
  // The screen's other write. Nothing about it reaches the email form, so the
  // same address property holds: retained beside it and unmarked.
  {
    ...refusedSave,
    id: "product/account/sign-in/github-refused",
    address: true,
    resting: "Continue with email",
  },
  // The reader's own text was refused, so the sentence is on the field and
  // nothing is said a second time above the control, which keeps its own
  // label: sending the same address again would be refused again. Mokly
  // answered, so the reference is still beneath it.
  {
    id: "product/account/sign-in/address-refused",
    back: "Continue with email",
    reference: true,
    marks: fieldRefusals.email,
  },
  {
    ...refusedSave,
    id: "product/account/sign-up/github-refused",
    address: true,
    resting: "Continue with email",
  },
  {
    id: "product/account/sign-up/address-refused",
    back: "Continue with email",
    reference: true,
    marks: fieldRefusals.email,
  },
  // Sign in's password section. A refused password is said on its field and
  // the control keeps its own label, as a refused address does; any other
  // refusal is said beside the control, with the password kept and unmarked.
  // Nothing about either reaches the email form.
  {
    id: "product/account/sign-in/preview-password/password-refused",
    back: "Continue as preview@mokly.ai",
    reference: true,
    address: true,
    resting: "Continue with email",
    password: { kept: previewPassword.typed, marks: fieldRefusals.password },
  },
  {
    ...refusedSave,
    id: "product/account/sign-in/preview-password/failure",
    address: true,
    resting: "Continue with email",
    password: { kept: previewPassword.typed },
  },
  // The connect page's grant request. Use another account sent nothing, but
  // it is a link here, so it is not read back as a resting button.
  { ...refusedSave, id: "product/account/connect-desktop/error" },
  { ...refusedSave, id: "product/settings/account/error" },
  { ...refusedSave, id: "product/settings/danger/error" },
  { ...refusedSave, id: "product/settings/project/error" },
  // Refused by the plan rather than by anything the reader can change, so the
  // control keeps its own label: the same request cannot be made to succeed
  // while the workspace is on the free plan, and the way on is beside it.
  {
    id: "product/settings/project/visibility/plan",
    cause: billing.copy.privateVisibility,
    back: "Make private",
    reference: true,
  },
  // Raised in the browser and never sent, so there is no reference to quote
  // and no request to send again: the control keeps its own label.
  {
    id: "product/settings/tokens/create/copy",
    cause: causes.clipboard,
    back: "Copy token",
    reference: false,
  },
  // A build card's Try again refused for a pull request that closed: the same
  // request would be refused again, so the control keeps its label, and Mokly
  // answered, so the reference is beneath it.
  {
    id: "product/viewer/standalone/build/refused",
    cause: causes.closedPullRequest,
    back: "Try again",
    reference: true,
  },
  // A build card's Cancel refused while Mokly was busy. The same request can
  // succeed, yet the control keeps Cancel, because Try again on a build card
  // requests a new build.
  {
    id: "product/viewer/standalone/build/refused/cancel",
    cause: causes.busy,
    back: "Cancel",
    reference: true,
  },
  // The publishing card's request refused while Mokly was busy: the same
  // request can succeed, so the control reads the way back.
  {
    ...refusedSave,
    id: "product/viewer/standalone/publish-refused",
  },
  // Refused because the project no longer builds: pressing it again would be
  // refused again, so the control keeps its own label.
  {
    id: "product/viewer/standalone/publish-refused/pull-request",
    cause: causes.buildsUnavailable,
    back: "Publish this pull request",
    reference: true,
  },
];

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "every drawn refusal stands beside the control that made it: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const refusal of refusals) {
          // Several drawings of one screen draw a refusal now, so the subject a
          // failure names has to be the drawing rather than the screen.
          const where = refusal.id;
          await page.goto(url(refusal.id));
          const fragment = page.locator(".fo-write-failure");
          await expect(fragment.getByRole("alert"), where).toHaveCount(
            refusal.cause ? 1 : 0,
          );
          if (refusal.cause !== undefined)
            await expect(fragment.getByRole("alert"), where).toHaveText(
              refusal.cause,
            );
          await expect(
            fragment.locator('[data-testid^="firna-button"]').first(),
            where,
          ).toHaveText(refusal.back);
          await expect(fragment.getByText(failureReference), where).toHaveCount(
            refusal.reference ? 1 : 0,
          );
          expect(await page.evaluate(failureOrder), where).toEqual({
            fragments: 1,
            causeAbove: refusal.cause !== undefined,
            references: refusal.reference ? 1 : 0,
            detailsBelow: refusal.reference,
          });
          if (refusal.resting)
            await expect(
              page.getByRole("button", {
                name: refusal.resting,
                exact: true,
              }),
              where,
            ).toBeVisible();
          if (refusal.marks !== undefined) {
            const marked = page.getByRole("textbox", {
              name: "Email",
              exact: true,
            });
            await expect(marked, where).toHaveAttribute("aria-invalid", "true");
            await expect(marked, where).toHaveValue(onboarding.incompleteEmail);
            await expect(page.getByText(refusal.marks), where).toHaveCount(1);
            // Nothing about the reader's address reaches the other control.
            await expect(
              page.locator('[data-testid="firna-button-secondary"]'),
              where,
            ).toHaveText("Continue with GitHub");
          }
          if (refusal.password !== undefined) {
            // A password field has no textbox role, so its label finds it.
            const field = page.getByLabel("Password", { exact: true });
            await expect(field, where).toHaveValue(refusal.password.kept);
            if (refusal.password.marks === undefined)
              await expect(field, where).not.toHaveAttribute(
                "aria-invalid",
                "true",
              );
            else {
              await expect(field, where).toHaveAttribute(
                "aria-invalid",
                "true",
              );
              await expect(
                page.getByText(refusal.password.marks),
                where,
              ).toHaveCount(1);
            }
          }
          if (!refusal.address) continue;
          // The address is not what this refusal was about, so it is neither
          // marked as the cause nor taken away from the reader.
          const field = page.getByRole("textbox", {
            name: "Email",
            exact: true,
          });
          await expect(field, where).toHaveValue(onboarding.email);
          await expect(field, where).not.toHaveAttribute(
            "aria-invalid",
            "true",
          );
        }
      },
    );
  }
