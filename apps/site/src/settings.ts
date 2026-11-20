/** Build-time configuration shared by Astro and the site checks. */
export interface SiteSettings {
  readonly origin: string;
  readonly stagePublication: string;
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
  const siteOrigin = origin(
    "SITE_ORIGIN",
    environment["SITE_ORIGIN"] ?? "http://localhost:4321",
  );
  const stage = environment["SITE_STAGE_PR"] ?? "sydney-v1";
  const segments = stage.split("/");
  if (
    stage.length === 0 ||
    stage.length > 100 ||
    !/^[A-Za-z0-9._/-]+$/.test(stage) ||
    stage.startsWith("/") ||
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error("SITE_STAGE_PR must be a safe branch or publication label");
  }
  return Object.freeze({
    origin: siteOrigin,
    stagePublication: stage,
  });
}

/** Read once per build process; malformed configuration aborts config loading. */
export const settings: SiteSettings = parseSettings(process.env);
