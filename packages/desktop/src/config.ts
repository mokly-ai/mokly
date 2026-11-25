export interface BuildConfig {
  apiOrigin: string;
  appOrigin: string;
  catalogueBaseDomain: string;
  revision: string;
  /** True only in the packages that a release publishes. */
  updates?: boolean;
}

export interface ConfigurationFiles {
  read(path: string): string;
  resolve(...paths: string[]): string;
}

/** Packaged applications use only the build inputs carried in their package. */
export function readConfiguration(
  files: ConfigurationFiles,
  options: {
    packaged: boolean;
    root: string;
    environment: Record<string, string | undefined>;
  },
): { config: BuildConfig; directory: string; catalogueSource: string } {
  const environment = options.packaged ? {} : options.environment;
  const config: BuildConfig = JSON.parse(
    files.read(
      environment.MKC_DESKTOP_BUILD_CONFIG ??
        files.resolve(options.root, "bundle/build-config.json"),
    ),
  );
  if (
    ![
      config.apiOrigin,
      config.appOrigin,
      config.catalogueBaseDomain,
      config.revision,
    ].every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new Error("Desktop build configuration is incomplete");
  }
  let catalogueSource = `https://*.${config.catalogueBaseDomain}`;
  const local = environment.MKC_DESKTOP_CATALOGUE_SOURCE;
  if (local) {
    // This narrow source admits the local server's per-publication subdomains.
    if (
      !/^http:\/\/\*\.localhost:[1-9][0-9]{0,4}$/.test(local) ||
      Number(local.split(":").at(-1)) > 65535
    ) {
      throw new Error(
        "Use http://*.localhost:<port> for the development catalogue source",
      );
    }
    catalogueSource = local;
  }
  return {
    config,
    directory:
      environment.MKC_DESKTOP_DIST ?? files.resolve(options.root, "bundle/web"),
    catalogueSource,
  };
}

/** Match app-server.mjs exactly; 'self' resolves to the desktop scheme origin. */
export function contentSecurityPolicy(
  config: BuildConfig,
  catalogueSource: string,
): string {
  // The live channel opens its WebSocket on the API origin: https maps to wss.
  const apiWebSocketOrigin = config.apiOrigin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `frame-src 'self' ${config.appOrigin} ${config.apiOrigin} ${catalogueSource}`,
    `connect-src 'self' ${config.appOrigin} ${config.apiOrigin} ${apiWebSocketOrigin} ${catalogueSource}`,
    `img-src 'self' data: ${catalogueSource}`,
    `font-src 'self' ${catalogueSource}`,
    `style-src 'self' 'unsafe-inline' ${catalogueSource}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
