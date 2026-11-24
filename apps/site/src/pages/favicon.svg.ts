/**
 * The brand favicon: the Mokly mark in the light and dark token colours,
 * switched by the reader's colour scheme. The icon has no surface of its own,
 * so a mask cuts a true gap where the front layer's halo goes.
 */

import { tokens } from "@mokly-cloud/tokens/tokens";

/** The custom properties that colour the mark in one scheme. */
function markColors(scheme: "light" | "dark"): string {
  const color = tokens.color[scheme];
  return `--text:${color.text};--signal:${color.signal};--on-signal:${color.onSignal}`;
}

export function GET(): Response {
  const body = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `<style>:root{${markColors("light")}}@media(prefers-color-scheme:dark){:root{${markColors("dark")}}}</style>`,
    '<mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff"/><rect x="9" y="8" width="20" height="21" rx="4.8" fill="#000" stroke="#000" stroke-width="1.6"/></mask>',
    '<rect x="3.6" y="3.6" width="18.8" height="19.8" rx="4.6" fill="none" stroke="var(--text)" stroke-width="1.8" mask="url(#gap)"/>',
    '<rect x="9" y="8" width="20" height="21" rx="4.8" fill="var(--signal)"/>',
    '<path d="M14 15h10M14 20h7" fill="none" stroke="var(--on-signal)" stroke-linecap="round" stroke-width="2.1"/>',
    "</svg>",
  ].join("");
  return new Response(body, {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}
