import type { Page } from "@playwright/test";

import { appOrigin } from "../origins";

/** Replace one catalogue GET response while leaving the exchange and CORS real. */
export async function routeAccessStatus(
  page: Page,
  origin: string,
  path: string,
  status: number,
  withBearer: boolean,
) {
  await page.route(
    (url) => url.origin === origin && url.pathname === path,
    async (route) => {
      const request = route.request();
      if (request.method() !== "GET") return route.fallback();
      const authorization = await request.headerValue("authorization");
      if ((authorization !== null) !== withBearer) return route.fallback();
      return route.fulfill({
        status,
        headers: {
          "access-control-allow-origin": appOrigin,
          "access-control-allow-credentials": "true",
        },
        body: "",
      });
    },
  );
}

const unavailableFrame = `<!doctype html>
<script>
  const host = new URL(location.href).searchParams.get("mokly-host");
  const channel = "mokly-frame-access";
  const send = (type) => parent.postMessage(JSON.stringify({ channel, version: 1, type }), host);
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== host || typeof event.data !== "string") return;
    const message = JSON.parse(event.data);
    if (message.channel === channel && message.version === 1 && message.type === "token" &&
        typeof message.token === "string" && message.token.length > 0 &&
        Number.isSafeInteger(message.expiresAt)) send("unavailable");
  });
  send("request");
</script>`;

/** A catalogue-origin document that can get a token but cannot use it to open. */
export async function routeUnavailableFrame(page: Page, origin: string) {
  await page.route(
    (url) =>
      url.origin === origin &&
      url.pathname.startsWith("/static/mokly-generated/") &&
      url.searchParams.get("mokly-host") === appOrigin,
    (route) =>
      route.fulfill({ contentType: "text/html", body: unavailableFrame }),
  );
}
