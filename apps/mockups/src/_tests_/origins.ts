const appPort = Number(process.env.MKC_APP_PORT ?? "8081");

/** The served mockup port, after the app suite's catalogue and provider ports. */
export const mockupsPort = Number(
  process.env.MKC_MOCKUPS_PORT ?? String(appPort + 4),
);

/** The origin the served mockup tests and their server configuration use. */
export const mockupsOrigin = `http://127.0.0.1:${mockupsPort}`;
