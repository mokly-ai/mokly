/**
 * Who answers for each drawn screen.
 *
 * The catalogue is the specification and the application is what shipped, so
 * every comparison between them starts here: which application source renders
 * one screen, and which region of the drawn page that source is answerable
 * for. Declared rather than inferred, so the comparison in `app-parity.ts` has
 * no heuristics to be wrong about.
 */

import { resolve } from "node:path";

import { catalogueRoot, screenView } from "./catalogue-paths";
import {
  callbackLandingPages,
  productFamilies,
  productSituations,
  productStates,
  situationStatePaths,
} from "./product-situations";

export const repository = resolve(catalogueRoot, "../..");

/**
 * The part of a page a screen's own component draws. A screen answers for one
 * region; the frames around it — the settings dialog's bar, the account canvas
 * — belong to somebody else, so a label drawn there is not this screen's to
 * match. Every region but one is the last on its page that holds a control, so
 * reading from its marker to the end of the document reads exactly it.
 *
 * `bar` is the exception, and the reason it is bounded below. The viewer's slot
 * bar is the *first* region on its page, so a marker-to-end read would sweep
 * the stage in with it; a page whose whole subject is the bar reads from the
 * bar's marker to the stage's instead. Those pages exist because the cloud
 * fills the bar's slots: what it calls a reader who has set no name, and the
 * offer it makes when a newer publication arrives, are drawings with nowhere
 * else to live.
 */
export const regions = {
  bar: "fo-top-bar",
  stage: "fo-stage-canvas",
  panel: "fo-viewer-panel-body",
  pane: "fo-dialog-body",
  panelled: "fo-account-content",
  recovery: "fo-recovery-body",
} as const;

/** Where a region stops, for the one region that is not the last on its page. */
export const regionEnds: Partial<Record<keyof typeof regions, string>> = {
  bar: "fo-stage-canvas",
};

/**
 * What every pane delegates: the retry a failed load offers, and the label a
 * control reads while its own write is working or refused. A pane names its
 * operation; these name the recovery, so both belong to every pane's answer.
 */
const shared = ["components/resource-state.tsx", "settings/write.ts"];

/**
 * What renders each product screen in the running application, and which
 * region of the drawn page that source is answerable for. Declared rather than
 * inferred, so the check has no heuristics: a screen with no owner yet names
 * the milestone that gives it one.
 */
const owners = {
  "product/account/sign-in": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/sign-up": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  // Continue with GitHub while its write runs. The same screen writes its
  // working word, the operation screen readers hear and the email control's
  // resting label.
  "product/account/sign-in/github-connecting": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/sign-up/github-connecting": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  // The connect Mokly refused. One screen writes every label on the page: the
  // way back the fragment puts on Continue with GitHub, and the resting label
  // the email control keeps because nothing was asked of it.
  "product/account/sign-in/github-refused": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/sign-up/github-refused": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  // GitHub sign-in before it is open. Nothing failed, so the page draws no way
  // back; the same screen writes the notice and every control label on it.
  "product/account/sign-in/github-opens-soon": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/sign-up/github-opens-soon": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  // The address the API refused. The sentence the field draws is declared by
  // the same screen, beside the ownership it declares, so one file answers for
  // the whole page: the field's sentence and every control label on it.
  "product/account/sign-in/address-refused": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/sign-up/address-refused": {
    region: "panelled",
    files: ["screens/account/entry-screen.tsx"],
  },
  "product/account/magic-link": {
    region: "panelled",
    files: ["screens/account/magic-link-screen.tsx"],
  },
  "product/account/callback": {
    region: "panelled",
    files: ["screens/account/callback-screen.tsx"],
  },
  // The desktop handoff is drawn by a module of its own beside the shared
  // landing, which only decides when to offer it: the handoff writes both of
  // its actions, so it alone answers for the page.
  "product/account/callback/desktop": {
    region: "panelled",
    files: ["screens/account/callback-handoff.tsx"],
  },
  // The GitHub installation landings each have a module of their own: the
  // setup landing draws the request, and the authorization callback draws its
  // two refusals. Each page is compared by what its heading and line say.
  "product/account/callback/install-requested": {
    region: "panelled",
    files: ["screens/account/github-install-screen.tsx"],
  },
  "product/account/callback/install-conflict": {
    region: "panelled",
    files: ["screens/account/github-callback-screen.tsx"],
  },
  "product/account/callback/install-denied": {
    region: "panelled",
    files: ["screens/account/github-callback-screen.tsx"],
  },
  // The same two landings while they complete the installation: the setup
  // landing and the authorization callback each name it in a wait of its own.
  "product/account/callback/install-setup": {
    region: "panelled",
    files: ["screens/account/github-install-screen.tsx"],
  },
  "product/account/callback/install-authorize": {
    region: "panelled",
    files: ["screens/account/github-callback-screen.tsx"],
  },
  "product/account/create-workspace": {
    region: "panelled",
    files: ["screens/account/create-workspace-screen.tsx"],
  },
  "product/account/create-workspace/slug": {
    region: "panelled",
    files: ["screens/account/create-workspace-screen.tsx"],
  },
  "product/account/create-workspace/suggestion-loading": {
    region: "panelled",
    files: ["screens/account/create-workspace-screen.tsx"],
  },
  "product/account/create-workspace/creating": {
    region: "panelled",
    files: ["screens/account/create-workspace-screen.tsx"],
  },
  "product/account/install-app": {
    region: "panelled",
    files: ["screens/account/install-screen.tsx"],
  },
  // The step read by a member and by a reviewer. Neither draws a control, so
  // each is compared by the lines it says, which the step will write.
  "product/account/install-app/member": {
    region: "panelled",
    files: ["screens/account/install-screen.tsx"],
  },
  "product/account/install-app/reviewer": {
    region: "panelled",
    files: ["screens/account/install-screen.tsx"],
  },
  // The suspension whose link could not be read: the step's own drawing, and
  // the suspension's own module answers for the failure beside the fact and
  // its retry.
  "product/account/install-app/suspended-unreadable": {
    region: "panelled",
    files: [
      "screens/account/install-screen.tsx",
      "screens/account/install-suspension.tsx",
    ],
  },
  // The suspension while its link is read, and Install on GitHub's write:
  // the step's own drawings, so its own module answers for both.
  "product/account/install-app/suspended-loading": {
    region: "panelled",
    files: ["screens/account/install-screen.tsx"],
  },
  "product/account/install-app/installing": {
    region: "panelled",
    files: ["screens/account/install-screen.tsx"],
  },
  // An installation that arrived from GitHub with no flow behind it. Its
  // workspace choice and its candidate flow are a module of their own.
  "product/account/install-app/connect": {
    region: "panelled",
    files: ["screens/account/connect-screen.tsx"],
  },
  "product/account/install-app/connect/one-workspace": {
    region: "panelled",
    files: ["screens/account/connect-screen.tsx"],
  },
  "product/account/install-app/connect/connecting": {
    region: "panelled",
    files: ["screens/account/connect-screen.tsx"],
  },
  "product/account/choose-repository": {
    region: "panelled",
    files: ["screens/account/choose-repository-screen.tsx"],
  },
  // The select open over its sections, and the flat select of a workspace
  // with one account: the step's own drawings, so its own module answers.
  "product/account/choose-repository/open": {
    region: "panelled",
    files: ["screens/account/choose-repository-screen.tsx"],
  },
  "product/account/choose-repository/one-account": {
    region: "panelled",
    files: ["screens/account/choose-repository-screen.tsx"],
  },
  "product/account/choose-repository/creating": {
    region: "panelled",
    files: ["screens/account/choose-repository-screen.tsx"],
  },
  // The CLI form is a route of its own, `/:workspace/-/new/cli`.
  "product/account/choose-repository/cli": {
    region: "panelled",
    files: ["screens/account/cli-form-screen.tsx"],
  },
  "product/account/choose-repository/cli/workspace-loading": {
    region: "panelled",
    files: ["screens/account/cli-form-screen.tsx"],
  },
  // The project's address is drawn by the part both project forms share: the
  // slug, its preview and the suggestion's own pending and failed states.
  "product/account/choose-repository/slug-taken": {
    region: "panelled",
    files: [
      "screens/account/choose-repository-screen.tsx",
      "screens/account/project-address.tsx",
    ],
  },
  "product/account/choose-repository/suggestion-loading": {
    region: "panelled",
    files: [
      "screens/account/choose-repository-screen.tsx",
      "screens/account/project-address.tsx",
    ],
  },
  "product/account/project-created": {
    region: "panelled",
    files: [
      "screens/account/project-created-screen.tsx",
      "screens/app/project-route.tsx",
    ],
  },
  "product/account/invitation-accept": {
    region: "panelled",
    files: ["screens/account/invitation-accept-screen.tsx"],
  },
  "product/account/invitation-accept/expired": {
    region: "panelled",
    files: ["screens/account/invitation-accept-screen.tsx"],
  },
  "product/account/invitation-accept/open-error": {
    region: "panelled",
    files: ["screens/account/invitation-accept-screen.tsx"],
  },
  "product/recovery/not-found": {
    region: "recovery",
    files: ["screens/app/not-found-screen.tsx"],
  },
  // The index's own failure belongs to the frames that resolve settings, not
  // to the pane that lists them.
  "product/settings/sections": {
    region: "pane",
    files: [
      "settings/panes/sections-pane.tsx",
      "settings/dialog-host.tsx",
      "settings/layer-screen.tsx",
      "settings/scope-wait.tsx",
      ...shared,
    ],
  },
  "product/settings/account": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", ...shared],
  },
  // The pane asked for by its address while the settings scope loads: the
  // scope's wait names the read, and the pane's own wait draws every control
  // in its waiting form.
  "product/settings/account/scope-loading": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", "settings/scope-wait.tsx"],
  },
  // The same pane while the session loads, before the scope is read: the
  // scope's wait names the wait, and the pane's own wait, which takes an
  // unknown session, draws every control in its waiting form.
  "product/settings/account/session-loading": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx", "settings/scope-wait.tsx"],
  },
  // Connect GitHub's write. The pane writes its working word, the operation
  // screen readers hear and every other control's resting label.
  "product/settings/account/github-connecting": {
    region: "pane",
    files: ["settings/panes/account-pane.tsx"],
  },
  "product/settings/workspace": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      ...shared,
    ],
  },
  // The GitHub accounts fact's own two situations. Nothing on either page has
  // failed to load and no write has been refused, so the pane alone answers
  // for both: it reads the accounts onto the fact and writes its Manage.
  "product/settings/workspace/suspended": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/absent": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  // The fact's own read of the installation list, running and failed. While
  // it runs the fact draws only a placeholder named to assistive technology,
  // which no control carries, so the pane alone answers for that page and the
  // situation test holds the name. A failure draws its retry, which the
  // fact's own module writes beside the failure.
  "product/settings/workspace/accounts-loading": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/accounts-unreadable": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      "settings/panes/workspace-github.tsx",
    ],
  },
  // The workspace back on the free plan. The pane reads the plan onto the
  // fact, says where its private projects stand and gives an owner the way on.
  "product/settings/workspace/plan": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
      "components/plan-consequence.tsx",
    ],
  },
  // The same workspace read by a member. The pane owns the consequence and
  // the sentence that gives everybody without Billing access their way on.
  "product/settings/workspace/plan-member": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  // The pane asked for by its address while the settings scope loads. The
  // scope's wait names the read; the pane's own wait draws Create project
  // disabled, and every other control waits as a placeholder.
  "product/settings/workspace/scope-loading": {
    region: "pane",
    files: ["settings/panes/workspace-pane.tsx", "settings/scope-wait.tsx"],
  },
  // Save's write. The pane writes the working word and the operation, and the
  // projects section beside it writes Create project.
  "product/settings/workspace/saving": {
    region: "pane",
    files: [
      "settings/panes/workspace-pane.tsx",
      "settings/panes/workspace-projects.tsx",
    ],
  },
  "product/settings/workspace/slug": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  // The GitHub accounts pane, its rows and its row menu. The remove modal is
  // a module of its own, drawn over the pane it belongs to.
  "product/settings/github": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx", ...shared],
  },
  "product/settings/github/suspended": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/member": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/menu": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/github/remove": {
    region: "pane",
    files: [
      "settings/panes/github-pane.tsx",
      "settings/panes/github-remove.tsx",
    ],
  },
  // Add GitHub account's write, which leaves for GitHub. The pane writes its
  // working word and the operation; the rows' menus draw no label the
  // comparison reads.
  "product/settings/github/adding": {
    region: "pane",
    files: ["settings/panes/github-pane.tsx"],
  },
  "product/settings/workspace/slug-recovery": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  "product/settings/members": {
    region: "pane",
    files: [
      "settings/panes/members-pane.tsx",
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
      ...shared,
    ],
  },
  // The pane asked for by its address while the settings scope loads. The
  // scope's wait names the scope read, and the pane's own waiting parts draw
  // its rows, the invite form and their controls.
  "product/settings/members/scope-loading": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/scope-wait.tsx",
    ],
  },
  // The pane's three writes, each on its own control. The rows, the invite
  // form and the person the reader manages each write their own labels, the
  // pressed control's working word and the operation it names among them.
  "product/settings/members/invitation-sending": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  "product/settings/members/invitation-revoking": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  "product/settings/members/role-saving": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  // One member's own row, opened. Nothing on it has failed to load and no
  // write has been refused, so neither shared answer is drawn here.
  "product/settings/members/identity": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
    ],
  },
  // The pane owns the four states and the deployment's own two situations;
  // the plans beside it own what a subscribed and an unsubscribed
  // workspace each read, which is where every label on those pages is
  // written.
  "product/settings/billing": {
    region: "pane",
    files: [
      "settings/panes/billing-pane.tsx",
      "settings/panes/billing-plans.tsx",
      ...shared,
    ],
  },
  // The pane asked for by its address while the session and the scope load.
  // Every value waits as a bar and every control as a placeholder, so the
  // scope's wait, which names the wait, is all it says.
  "product/settings/billing/scope-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  // The same wait on the pane's durable route on a wide surface until it
  // hands over to the dialog. The rail, whose panes with no address yet wait
  // disabled, is the frame's, so the pane says what the scope's wait says.
  "product/settings/billing/route-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  // The landing Checkout returns to, which offers nothing to press until the
  // webhook has written the plan: the pane names what it is doing and the
  // comparison reads that sentence rather than a control.
  "product/settings/billing/confirming": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  // The bounded confirmation ended before Team appeared. The pane owns this
  // notice and its one fresh read, just as it owns confirming.
  "product/settings/billing/delayed": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  // Check again's write: the pane owns its one fresh read, its working word
  // and the operation, as it owns the delayed notice.
  "product/settings/billing/delayed/checking": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  "product/settings/billing/trial": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/past-due": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/ending": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The same facts read by an admin, whose way on is a sentence rather than a
  // control, so this page too is compared by what it says.
  "product/settings/billing/admin": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The free plan read by an admin has the same role boundary and no action.
  "product/settings/billing/admin-free": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // The deployment's own two: billing that is not configured at all, whose
  // whole drawing is one notice, and a configured price the catalogue could
  // not confirm, which keeps the section its title and its way on.
  "product/settings/billing/unavailable": {
    region: "pane",
    files: ["settings/panes/billing-pane.tsx"],
  },
  "product/settings/billing/unpriced": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // Upgrade to Team's and Manage billing's writes, which leave for Stripe.
  // The plans own each control, its working word and the operation, and the
  // free plan's state title.
  "product/settings/billing/checkout-opening": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  "product/settings/billing/portal-opening": {
    region: "pane",
    files: ["settings/panes/billing-plans.tsx"],
  },
  // Losing access is asked in a modal over the person it concerns, so the page
  // draws the pane beneath and the modal's own two decisions.
  "product/settings/members/remove": {
    region: "pane",
    files: [
      "settings/panes/member-rows.tsx",
      "settings/panes/member-invite.tsx",
      "settings/panes/member-details.tsx",
      "settings/panes/member-remove.tsx",
    ],
  },
  "product/settings/project": {
    region: "pane",
    files: ["settings/panes/project-pane.tsx", ...shared],
  },
  // A write in flight in the modal the pane opened: the modal writes the label
  // its control reads while it works, and nothing here offers the way back a
  // refusal would.
  "product/settings/project/visibility": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  // The same modal, refused by the plan. Its implementation writes the refusal
  // and both decisions; the shared role rule owns the way on to Billing.
  "product/settings/project/visibility/plan": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
      "components/plan-consequence.tsx",
    ],
  },
  // The refusal an admin reads, whose way on is a sentence rather than a
  // control; the pane beneath and its visibility modal own every label.
  "product/settings/project/visibility/plan-admin": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  // The visibility write in flight towards private: the modal writes the
  // label its control reads while it works and the operation it names, and
  // the pane beneath writes its own controls.
  "product/settings/project/visibility/private": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-visibility.tsx",
    ],
  },
  "product/settings/project/slug": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  "product/settings/project/slug/conflict": {
    region: "pane",
    files: ["settings/panes/slug-editor.tsx"],
  },
  // The pane of a project that cannot build says one sentence where the
  // Automatic builds switch would be. The pane chooses between the two, and a
  // switch draws no label the comparison reads, so the pane answers for the
  // page and the sentence it says is declared below.
  "product/settings/project/no-builds": {
    region: "pane",
    files: ["settings/panes/project-pane.tsx"],
  },
  // The Automatic builds switch while its own write runs. The pane draws
  // around it, and the switch's own module names the write.
  "product/settings/project/builds-saving": {
    region: "pane",
    files: [
      "settings/panes/project-pane.tsx",
      "settings/panes/project-builds.tsx",
    ],
  },
  // The pane asked for by its address while the settings scope loads. Every
  // control of the pane's wait is a placeholder or a switch, which draw no
  // label the comparison reads, so the scope's wait, which names the read,
  // answers for the page alone.
  "product/settings/project/scope-loading": {
    region: "pane",
    files: ["settings/scope-wait.tsx"],
  },
  "product/settings/tokens": {
    region: "pane",
    files: ["settings/panes/tokens-pane.tsx", ...shared],
  },
  // Naming a token and taking its secret are one modal, because the reader is
  // still inside the operation they started. The reveal and the browser that
  // would not copy it are two drawings of that modal's second half.
  "product/settings/tokens/create": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  "product/settings/tokens/create/reveal": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  "product/settings/tokens/create/copy": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-create.tsx",
    ],
  },
  // Revoking is asked over the row it belongs to, reached from that row's own
  // three-dot menu. The menu's rows are the pane's; the pane region is read on
  // the desktop page, where the menu draws no button of its own.
  "product/settings/tokens/revoke": {
    region: "pane",
    files: [
      "settings/panes/tokens-pane.tsx",
      "settings/panes/tokens-revoke.tsx",
    ],
  },
  "product/settings/tokens/revoke/menu": {
    region: "pane",
    files: ["settings/panes/tokens-pane.tsx"],
  },
  "product/settings/access": {
    region: "pane",
    files: ["settings/panes/access-pane.tsx", ...shared],
  },
  "product/settings/danger": {
    region: "pane",
    files: ["settings/panes/danger-pane.tsx", ...shared],
  },
  // The pane asked for by its address while the settings scope loads: the
  // scope's wait names the read, and the pane's own wait draws both controls
  // disabled.
  "product/settings/danger/scope-loading": {
    region: "pane",
    files: ["settings/panes/danger-pane.tsx", "settings/scope-wait.tsx"],
  },
  // Milestone 13 resolves the publication, so the one card the stage draws is
  // chosen in `stage-view.tsx` and drawn by `stage.tsx`; the route composes
  // them rather than writing their copy itself.
  "product/viewer/standalone": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  // The sentence a failed read announces is chosen in `stage-view.tsx` and
  // handed to the card `stage.tsx` draws, so both answer for this page. The
  // three pages above name only `stage.tsx`, because every card they draw
  // writes its own words there.
  "product/viewer/standalone/unreadable": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The same branch in a project the free plan publishes nothing to. The card
  // is the stage's own, like every other one it draws for a branch with no
  // publication, including the owner's way on to Billing.
  "product/viewer/standalone/plan": {
    region: "stage",
    files: ["viewer/stage.tsx", "components/plan-consequence.tsx"],
  },
  // The same card read by everyone who cannot open billing themselves: the
  // switcher is the one control on it, which the stage already writes.
  "product/viewer/standalone/plan-reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The workspace ownership read that decides who can open Billing failed.
  // Which read failed is decided in `stage-view.tsx` and handed to the card
  // `stage.tsx` draws, so both answer for this page, exactly as they do for the
  // publication read that failed.
  "product/viewer/standalone/workspace-unreadable": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  // A build's titles and action labels come from `build-copy.ts`. The build
  // address's read, unknown and unreadable states also use the switcher and
  // retry labels that `stage.tsx` writes.
  "product/viewer/standalone/build": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  "product/viewer/standalone/build/published": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed/timed-out": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/failed/infrastructure": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A plan refusal takes the Team card's title, and the owner's way on is the
  // shared role rule's Open billing.
  "product/viewer/standalone/build/failed/plan": {
    region: "stage",
    files: ["viewer/build-copy.ts", "components/plan-consequence.tsx"],
  },
  "product/viewer/standalone/build/failed/version": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/superseded": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/superseded/cancelled": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/unreadable": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  // A lockfile builds cannot install: the title and the line are chosen in
  // `build-copy.ts`. The card's one action is a link, which the label
  // comparison does not read, so the line is held to the product as a
  // declared sentence below.
  "product/viewer/standalone/build/lockfile": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A Try again the API refused keeps the card's title and its own label;
  // the refusal above it is a fixture cause read from `api/form-error.ts`.
  "product/viewer/standalone/build/refused": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A Cancel the API refused keeps the card's title and Cancel, both written
  // in `build-copy.ts`. The refusal above it is a fixture cause read from
  // `api/form-error.ts`.
  "product/viewer/standalone/build/refused/cancel": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // Cancel and Try again while their requests run: the card's title, each
  // control's working word and the operation screen readers hear are all
  // written in `build-copy.ts`.
  "product/viewer/standalone/build/cancel-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/try-again-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A body that depends on its reader offers no action, so the title chosen
  // in `build-copy.ts` is all a label can compare; the plan refusal's line
  // for everyone but an owner, and the line of a queued build a reviewer
  // cannot cancel, are held to the product as declared sentences.
  "product/viewer/standalone/build/reader": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/reader/plan": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // While the workspace read runs, `build-card.tsx` draws the owner's action
  // as a placeholder and names that read for screen readers.
  "product/viewer/standalone/build/reader/plan-loading": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/build-card.tsx"],
  },
  "product/viewer/standalone/build/reader/queued": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/build/reader/running": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A reference showing its running build draws the same card.
  "product/viewer/standalone/publish/publishing": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/pull-request/publishing": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // The publishing card takes its labels from `build-copy.ts`. The reviewer's
  // waiting card keeps the switcher `stage.tsx` writes.
  "product/viewer/standalone/publish": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/publish/pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  "product/viewer/standalone/publish/reader": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  "product/viewer/standalone/publish/reader-pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts", "viewer/stage.tsx"],
  },
  // A refused publish request keeps the card's labels from `build-copy.ts`.
  // Where the same request could succeed, the control reads the shared way
  // back, which `settings/write.ts` writes; otherwise it keeps its own label.
  "product/viewer/standalone/publish-refused": {
    region: "stage",
    files: ["viewer/build-copy.ts", "settings/write.ts"],
  },
  "product/viewer/standalone/publish-refused/pull-request": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // Publish this branch while its request runs keeps the card's title; its
  // working word and the operation screen readers hear are in
  // `build-copy.ts` too.
  "product/viewer/standalone/publish-busy": {
    region: "stage",
    files: ["viewer/build-copy.ts"],
  },
  // A project with nothing observed yet draws no rows and offers no retry, so
  // the panel alone answers for it.
  "product/viewer/switcher/no-branches": {
    region: "panel",
    files: ["viewer/panels/switcher.tsx"],
  },
  // What the bar calls the reader is the slot bar's, which no screen owns; the
  // stage this page answers for holds the catalogue, so its region is blank.
  // The bar is this page's whole subject: what the cloud calls a reader who
  // has not set a name. `slots.tsx` computes the values, `chrome.tsx` joins the
  // workspace and project and draws the control, and the stage below it
  // holds the catalogue.
  "product/viewer/standalone/account": {
    region: "bar",
    files: [
      "viewer/chrome.tsx",
      "screens/viewer/slots.tsx",
      "screens/viewer/more-menu.tsx",
    ],
  },
  // A failed attempt is named by the classification Mokly kept, which is read
  // and worded in `failure.ts`; the card around it is the stage's own.
  "product/viewer/standalone/failed": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/failure.ts"],
  },
  "product/viewer/standalone/version": {
    region: "stage",
    files: ["viewer/version-failure.tsx"],
  },
  // The route's project read draws the cloud frame over the stage's waiting
  // card: the viewer route names the read and passes the project route its
  // wait. The frame's heading names the read, ahead of the stage, whose card
  // holds only placeholders, so a declared sentence below compares the name.
  "product/viewer/standalone/project-loading": {
    region: "stage",
    files: ["screens/app/viewer-route.tsx"],
  },
  // The stage's other waits are chosen and named in `stage-view.tsx`, which
  // hands each one to the waiting card `stage-card.tsx` draws. While a
  // publication's address is read, `screens/viewer/slots.tsx` draws the
  // reference trigger's placeholder from `viewer/chrome-wait.tsx`; it has no
  // label to compare, so `viewer-reference-wait.test.ts` holds the bar.
  "product/viewer/standalone/publication-loading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/plan-loading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/uploading": {
    region: "stage",
    files: ["viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/catalogue": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/catalogue/comparison": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // Likewise the offer a newer publication produces: the chrome writes it, and
  // it appears beside the publication the reader is already on.
  "product/viewer/standalone/latest": {
    region: "bar",
    files: [
      "viewer/chrome.tsx",
      "screens/viewer/slots.tsx",
      "screens/viewer/more-menu.tsx",
    ],
  },
  "product/viewer/pull-request": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  // The card a closed or merged pull request's alias shows: a title that names
  // how it closed, and the switcher.
  "product/viewer/pull-request/closed": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  "product/viewer/pull-request/closed/merged": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The card a fork's alias shows: the fact as its title and what the reader
  // can do as its line, which `fork-card.tsx` writes, and the switcher
  // `stage.tsx` already writes.
  "product/viewer/pull-request/fork": {
    region: "stage",
    files: ["viewer/fork-card.tsx", "viewer/stage.tsx"],
  },
  // A plan-refused pull request with nothing published shows the Team card a
  // branch shows, so the stage's own card and the shared role rule answer
  // for it, exactly as for `product/viewer/standalone/plan` and
  // `plan-reader`.
  "product/viewer/pull-request/plan": {
    region: "stage",
    files: ["viewer/stage.tsx", "components/plan-consequence.tsx"],
  },
  "product/viewer/pull-request/plan/reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The four panels the viewer's slots open arrived with Milestone 13, which
  // is what this table's liveness property was waiting for. Each delegates its
  // failed-load retry to the shared resource state, so both are answerable.
  "product/viewer/projects": {
    region: "panel",
    files: ["viewer/panels/projects.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/switcher": {
    region: "panel",
    files: ["viewer/panels/switcher.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/history": {
    region: "panel",
    files: ["viewer/panels/history.tsx", "components/resource-state.tsx"],
  },
  "product/viewer/share": {
    region: "panel",
    files: [
      "viewer/panels/share.tsx",
      "viewer/panels/share-link.tsx",
      "components/resource-state.tsx",
    ],
  },
  // The panel with nothing to compare draws only the link it can still offer,
  // so the link's own module answers for it: no load of its own fails on
  // this page.
  "product/viewer/share/catalogue": {
    region: "panel",
    files: ["viewer/panels/share-link.tsx"],
  },
} as const satisfies Record<ScreenId, Owner>;

/** A sentence written directly or reached through one named shared constant. */
export type SentenceDeclaration =
  string | { sentence: string; constant: { file: string; name: string } };

/**
 * Exact sentences whose parity matters beyond controls, options and titles.
 *
 * The label comparison reads buttons, segmented options and state titles, and
 * three of the Billing pane's pages draw none of them: the landing Checkout
 * returns to says only what it is doing, the admin's reading answers with a
 * sentence rather than an action, and a deployment with no billing configured
 * says the one thing it knows. A page with nothing to compare is a gap rather
 * than a pass, so each names the sentences it draws instead, and the suite
 * holds both the drawn page and the owning source to them. A page may also
 * name essential prose beside a title, as the admin's Free plan, the
 * unsupported-lockfile build's line, the plan refusal's line for everyone but
 * an owner, a reviewer's queued build's line and the fork card's line do. It
 * may also name the heading of an account panel, which no control, option or
 * state title carries: the desktop handoff's was redrawn so that it stops
 * repeating the action below it, and the running screen has to say the new one.
 * The install step read by a member or a reviewer draws no control at all, and
 * the GitHub installation landings say their outcome in a heading and a line.
 * The GitHub accounts pane read by a member draws no control either, so it is
 * compared by the heading its accounts sit under.
 */
export const sentences: Partial<
  Record<ScreenId, readonly SentenceDeclaration[]>
> = {
  "product/settings/billing/confirming": ["Confirming your subscription"],
  "product/settings/billing/admin": [
    {
      sentence: "An owner manages billing.",
      constant: { file: "api/labels.ts", name: "ownerManagesBilling" },
    },
  ],
  "product/settings/billing/admin-free": [
    {
      sentence: "An owner manages billing.",
      constant: { file: "api/labels.ts", name: "ownerManagesBilling" },
    },
  ],
  "product/settings/billing/unavailable": ["Billing opens soon."],
  "product/account/callback/desktop": ["Finish signing in"],
  "product/settings/project/no-builds": [
    {
      sentence: "This project publishes from CI.",
      constant: { file: "api/labels.ts", name: "publishesFromCi" },
    },
  ],
  "product/viewer/standalone/build/lockfile": [
    "Mokly installs with npm, pnpm or Yarn.",
  ],
  "product/viewer/standalone/build/reader/plan": [
    {
      sentence: "Ask an owner to upgrade to Team.",
      constant: { file: "api/labels.ts", name: "askAnOwnerToUpgrade" },
    },
  ],
  "product/viewer/standalone/build/reader/queued": ["Waiting to start."],
  "product/viewer/pull-request/fork": [
    "Review this pull request’s screens locally.",
  ],
  // The install step for a member and for a reviewer draws no control, so its
  // heading and line are the page; a member keeps the way to the CLI form,
  // which the repository step's own drawings say too.
  "product/account/install-app/member": [
    "Install the Mokly app",
    "Ask an owner or admin to install it.",
    "Publish with the CLI instead",
  ],
  "product/account/install-app/reviewer": [
    "No projects yet",
    "Ask an owner or admin to create the first project.",
  ],
  "product/account/choose-repository/open": ["Publish with the CLI instead"],
  "product/account/choose-repository/one-account": [
    "Publish with the CLI instead",
  ],
  "product/account/choose-repository/slug-taken": [
    "Publish with the CLI instead",
  ],
  "product/account/callback/install-requested": [
    "Installation requested",
    "An owner of the GitHub organization approves it on GitHub.",
  ],
  "product/account/callback/install-conflict": [
    "This GitHub account is connected to another workspace",
    "Remove it from that workspace first.",
  ],
  "product/account/callback/install-denied": [
    "You don’t administer this GitHub account",
  ],
  "product/settings/github/member": ["Connected accounts"],
  // The GitHub accounts fact's failed read says so beside its quiet retry,
  // and so does the install step's suspension whose link could not be read.
  "product/settings/workspace/accounts-unreadable": ["Couldn’t load"],
  "product/account/install-app/suspended-unreadable": ["Couldn’t load"],
  // The route's project read names itself in the frame's heading, for screen
  // readers, and the stage it answers for draws only placeholders.
  "product/viewer/standalone/project-loading": ["Opening your project"],
};

/**
 * Sentences deliberately removed from a drawing. Each must stay out of both the
 * generated page and the source that owns the running screen, whether that
 * source writes the sentence or reaches for the constant that holds it. A
 * sentence with no shared home is declared as itself.
 */
export const droppedSentences: Partial<
  Record<ScreenId, readonly SentenceDeclaration[]>
> = {
  "product/account/project-created": [
    {
      sentence: "Projects are public on the free plan.",
      constant: { file: "api/labels.ts", name: "publicOnFree" },
    },
  ],
  // The heading repeated Open Mokly, the action directly below it.
  "product/account/callback/desktop": ["Open Mokly to finish signing in"],
};

/**
 * The callback landing pages a module of their own draws. One component draws
 * the pending landing and every failure, so those pages answer to
 * `product/account/callback`; each page named here answers for itself.
 */
const separateCallbacks = [
  "product/account/callback/desktop",
  "product/account/callback/install-requested",
  "product/account/callback/install-conflict",
  "product/account/callback/install-denied",
  "product/account/callback/install-setup",
  "product/account/callback/install-authorize",
] as const;

/**
 * Every screen the catalogue owns, derived from the inventory it is declared
 * in. `owners` is keyed by this union, so a screen added to the inventory
 * without an owner is a type error rather than a crash at the first read.
 */
export type ScreenId =
  | {
      [
        Family in keyof typeof productFamilies
      ]: `product/${Family}/${(typeof productFamilies)[Family][number]}`;
    }[keyof typeof productFamilies]
  | (typeof productSituations)[number]["path"]
  | "product/account/callback"
  | (typeof separateCallbacks)[number];

/** The screen one callback landing page answers to. */
function callbackScreen(page: string): ScreenId {
  return (
    separateCallbacks.find((screen) => screen === page) ??
    "product/account/callback"
  );
}

/** One screen's answer: who draws it, or the path whose arrival will. */
export type Owner = { region: keyof typeof regions } & (
  | { files: readonly string[]; pending?: undefined }
  | { pending: string; files?: undefined }
);

/** The declared owner of one screen, read through the shape above. */
export function ownerOf(screen: ScreenId): Owner {
  return owners[screen] as Owner;
}

/** Every screen the table declares, with its owner. */
export function declared(): [ScreenId, Owner][] {
  return (Object.keys(owners) as ScreenId[]).map((screen) => [
    screen,
    ownerOf(screen),
  ]);
}

/** The repair a missing owner file needs, in place of a read that throws. */
export function missingOwner(screen: string, path: string): Error {
  return new Error("declare the new owner for " + screen + ": " + path);
}

/** Every catalogued screen with the page and the owner its labels answer to. */
export function parityPages(): {
  screen: ScreenId;
  id: string;
  file: string;
}[] {
  const states = Object.entries(productFamilies).flatMap(([family, screens]) =>
    screens.flatMap((screen) =>
      productStates.map((state) => {
        const id =
          "product/" +
          family +
          "/" +
          screen +
          (state === "default" ? "" : "/" + state);
        return {
          screen: ("product/" + family + "/" + screen) as ScreenId,
          id,
          file: screenView(id, "desktop"),
        };
      }),
    ),
  );
  const situations = productSituations.flatMap((situation) =>
    situationStatePaths(situation).map((id) => ({
      screen: situation.path,
      id,
      file: screenView(id, "desktop"),
    })),
  );
  const callbacks = callbackLandingPages.map((page) => ({
    screen: callbackScreen(page.path),
    id: page.path,
    file: screenView(page.path, "desktop"),
  }));
  return [...states, ...situations, ...callbacks];
}
