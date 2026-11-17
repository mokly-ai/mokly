import type { Owner } from "../app-regions";

export const accountOwners = {
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
} as const satisfies Record<string, Owner>;
