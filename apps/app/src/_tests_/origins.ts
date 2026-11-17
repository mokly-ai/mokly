/**
 * Where the browser suite expects the API and the application to listen. Both
 * are configurable so a second worktree, or CI running suites side by side, can
 * use its own pair rather than colliding on one.
 */
const apiPort = Number(process.env.MKC_API_PORT ?? "8080");
const appPort = Number(process.env.MKC_APP_PORT ?? "8081");
// The catalogue never shares the app's origin, so it takes its own port beside
// the pair the suite was given rather than a third variable to keep in step.
const cataloguePort = Number(
  process.env.MKC_CATALOGUE_PORT ?? String(appPort + 1),
);
// The billing provider double takes the next port beside them, for the same
// reason: one pair configures a whole run, and nothing collides with a suite
// running alongside it.
const stripeDoublePort = Number(
  process.env.MKC_STRIPE_PORT ?? String(appPort + 2),
);
// The recorded GitHub is another server of the suite's own, so it takes the
// port after the billing double's for the same reason.
const githubPort = Number(process.env.MKC_GITHUB_PORT ?? String(appPort + 3));

/** The loopback address the API binds. */
export const apiBind = `127.0.0.1:${apiPort}`;

/** The API origin the application and the tests call. */
export const apiOrigin = `http://localhost:${apiPort}`;

/** The origin the exported build is served from. */
export const appOrigin = `http://localhost:${appPort}`;

/** The loopback address the catalogue server binds. */
export const catalogueBind = `127.0.0.1:${cataloguePort}`;

/** The port the billing provider double listens on. */
export const stripePort = stripeDoublePort;

/** The loopback address the billing provider double binds. */
export const stripeBind = `127.0.0.1:${stripeDoublePort}`;

/**
 * The webhook signing secret the API is configured with and the suite signs
 * deliveries against, so the API's own verifier is what accepts them.
 */
export const stripeWebhookSecret = "whsec_appsuitefixture";

/**
 * The origin published catalogues are served from. Every publication gets its
 * own `p-<id>.localhost` host under it, which is a different origin from the
 * app in exactly the way production requires.
 */
export const catalogueOrigin = `http://localhost:${cataloguePort}`;

/** The loopback address the recorded GitHub binds. */
export const githubBind = `127.0.0.1:${githubPort}`;

/**
 * The origin the API reaches GitHub at, and the origin its installation and
 * authorization URLs are built from. The suite answers both with the same
 * recordings the API's own integration tests replay, so an installation the
 * browser walks is the real exchange rather than a routed answer.
 */
export const githubOrigin = `http://localhost:${githubPort}`;

/** The signing key the API and the catalogue server share for one suite run. */
export const catalogueSigningKey = "1".repeat(64);

/** The command that serves the exported build for the suite. */
export const appServerCommand = `node scripts/serve-dist.mjs dist ${appPort}`;
