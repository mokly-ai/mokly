/** Build-time configuration shared by Astro and the site checks. */
export interface SiteSettings {
  readonly appOrigin: string;
  readonly origin: string;
  readonly stagePr: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

function origin(name: string, value: string): string {
  const parsed = URL.canParse(value) ? new URL(value) : undefined;
  if (
    !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(value) ||
    !parsed ||
    parsed.pathname !== "/" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${name} must be an absolute HTTP(S) origin without a path, query, fragment or userinfo`,
    );
  }
  return parsed.origin;
}

/** Validate an explicit environment without consulting ambient state. */
export function parseSettings(environment: Environment): SiteSettings {
  const appOrigin = origin(
    "SITE_APP_ORIGIN",
    environment["SITE_APP_ORIGIN"] ?? "https://app.mokly.ai",
  );
  const siteOrigin = origin(
    "SITE_ORIGIN",
    environment["SITE_ORIGIN"] ?? "http://localhost:4321",
  );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(siteOrigin).hostname,
  );
  const stage = environment["SITE_STAGE_PR"] ?? (local ? "71" : undefined);
  if (
    stage === undefined ||
    !/^[0-9]+$/.test(stage) ||
    !Number.isSafeInteger(Number(stage)) ||
    Number(stage) <= 0
  ) {
    throw new Error("SITE_STAGE_PR must be a positive safe integer");
  }
  return Object.freeze({
    appOrigin,
    origin: siteOrigin,
    stagePr: Number(stage),
  });
}

/** Read once per build process; malformed configuration aborts config loading. */
export const settings: SiteSettings = parseSettings(process.env);
