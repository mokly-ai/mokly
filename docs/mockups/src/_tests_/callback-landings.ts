/**
 * The shared sign-in landing has protocol-named outcomes rather than the
 * data-screen empty/loading/error taxonomy. Its canonical pending screen comes
 * first, and it is also the pending state of the email, preview and desktop
 * landings; each provider's first outcome is a screen whose other outcomes are
 * its variants, so no screen carries more than four. The desktop landing is in
 * the app's window, which is signed out. The GitHub installation landings
 * follow, each a screen of its own because each says something the others do
 * not; a reader starts that flow signed in, so their header names the reader.
 */
export const callbackLandingPages = [
  { path: "product/account/callback", state: "pending" },
  { path: "product/account/callback/email-invalid", state: "invalid" },
  { path: "product/account/callback/email-invalid/expired", state: "expired" },
  { path: "product/account/callback/email-invalid/used", state: "used" },
  { path: "product/account/callback/email-invalid/failure", state: "failure" },
  { path: "product/account/callback/preview-invalid", state: "invalid" },
  {
    path: "product/account/callback/preview-invalid/failure",
    state: "failure",
  },
  { path: "product/account/callback/desktop-expired", state: "expired" },
  {
    path: "product/account/callback/desktop-expired/failure",
    state: "failure",
  },
  {
    path: "product/account/callback/install-requested",
    state: "requested",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-conflict",
    state: "conflict",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-denied",
    state: "denied",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-setup",
    state: "pending",
    signedIn: true,
  },
  {
    path: "product/account/callback/install-authorize",
    state: "pending",
    signedIn: true,
  },
] as const;

/** The callback landing's screens and the exact order of their variants. */
export const callbackLandingScreens = [
  { path: "product/account/callback", variants: [] },
  {
    path: "product/account/callback/email-invalid",
    variants: [
      "product/account/callback/email-invalid/expired",
      "product/account/callback/email-invalid/used",
      "product/account/callback/email-invalid/failure",
    ],
  },
  {
    path: "product/account/callback/preview-invalid",
    variants: ["product/account/callback/preview-invalid/failure"],
  },
  {
    path: "product/account/callback/desktop-expired",
    variants: ["product/account/callback/desktop-expired/failure"],
  },
  { path: "product/account/callback/install-requested", variants: [] },
  { path: "product/account/callback/install-conflict", variants: [] },
  { path: "product/account/callback/install-denied", variants: [] },
  { path: "product/account/callback/install-setup", variants: [] },
  { path: "product/account/callback/install-authorize", variants: [] },
] as const;
