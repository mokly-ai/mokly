/** Build-time configuration shared by Astro and the site checks. */
export interface SiteSettings {
  readonly origin: string;
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
  return Object.freeze({
    origin: origin(
      "SITE_ORIGIN",
      environment["SITE_ORIGIN"] ?? "http://localhost:4321",
    ),
  });
}

/** Read once per build process; malformed configuration aborts config loading. */
export const settings: SiteSettings = parseSettings(process.env);
