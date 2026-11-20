/** The brand favicon, generated from the canonical light and dark tokens. */

import { tokens } from "@mokly-cloud/tokens/tokens";

export function GET(): Response {
  const light = tokens.color.light;
  const dark = tokens.color.dark;
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>:root{--accent:${light.accent};--surface:${light.folioSurface}}@media(prefers-color-scheme:dark){:root{--accent:${dark.accent};--surface:${dark.folioSurface}}}</style><rect x="3" y="3" width="20" height="21" rx="4" fill="var(--accent)" opacity=".3"/><rect x="9" y="8" width="20" height="21" rx="4" fill="var(--accent)"/><path d="M14 15h10M14 20h7" stroke="var(--surface)" stroke-width="2" stroke-linecap="round"/></svg>`;
  return new Response(body, {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}
