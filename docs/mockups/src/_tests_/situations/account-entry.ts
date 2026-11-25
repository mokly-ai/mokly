import type { ProductSituation } from "../product-situation";

export const accountEntrySituations = [
  // The desktop app's window draws its own entry beside sign in and sign up:
  // one action that opens the browser, and the same entry while it waits.
  {
    path: "product/account/sign-in/desktop",
    family: "account",
    screen: "sign-in",
    name: "desktop",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/desktop/waiting",
    family: "account",
    screen: "sign-in",
    name: "waiting",
    parent: "product/account/sign-in/desktop",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/desktop",
    family: "account",
    screen: "sign-up",
    name: "desktop",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/desktop/waiting",
    family: "account",
    screen: "sign-up",
    name: "waiting",
    parent: "product/account/sign-up/desktop",
    states: ["default"],
  },
  // The connect page once Open Mokly has handed the grant to the app.
  {
    path: "product/account/connect-desktop/opened",
    family: "account",
    screen: "connect-desktop",
    name: "opened",
    states: ["default"],
  },
  // The connect page while the session read runs. The page already draws its
  // four variants, so the wait is a screen beside it, and its controls wait
  // disabled.
  {
    path: "product/account/connect-desktop/session-loading",
    family: "account",
    screen: "connect-desktop",
    name: "session-loading",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // Continue with GitHub's write on each entry screen, a screen beside it
  // like the other GitHub situations.
  {
    path: "product/account/sign-in/github-connecting",
    family: "account",
    screen: "sign-in",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-up/github-connecting",
    family: "account",
    screen: "sign-up",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-in/github-refused",
    family: "account",
    screen: "sign-in",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-refused",
    family: "account",
    screen: "sign-up",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/github-opens-soon",
    family: "account",
    screen: "sign-in",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-opens-soon",
    family: "account",
    screen: "sign-up",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/address-refused",
    family: "account",
    screen: "sign-in",
    name: "address-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/address-refused",
    family: "account",
    screen: "sign-up",
    name: "address-refused",
    states: ["default"],
  },
  // Sign in's password section, where the configuration answer names a shared
  // account: a screen beside sign in. Its refused password and its refused
  // write are its variants, and its write is a screen beside it.
  {
    path: "product/account/sign-in/preview-password",
    family: "account",
    screen: "sign-in",
    name: "preview-password",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/preview-password/password-refused",
    family: "account",
    screen: "sign-in",
    name: "password-refused",
    parent: "product/account/sign-in/preview-password",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/preview-password/failure",
    family: "account",
    screen: "sign-in",
    name: "failure",
    parent: "product/account/sign-in/preview-password",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/preview-password/signing-in",
    family: "account",
    screen: "sign-in",
    name: "signing-in",
    parent: "product/account/sign-in/preview-password",
    sibling: true,
    states: ["default"],
    pending: true,
  },
] as const satisfies readonly ProductSituation[];
