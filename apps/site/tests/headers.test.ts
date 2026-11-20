import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import config from "../astro.config.mjs";
import { sitePath } from "../src/workspace.js";

const CORS_HEADER = "Access-Control-Allow-Origin";
const CSP_HEADER_NAME = "Content-Security-Policy";
const CSP_HEADER =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";

test("Cloudflare Pages permits sandboxed stage assets to load", async () => {
  assert.equal(
    await readFile(sitePath("public", "_headers"), "utf8"),
    `/*\n  ${CORS_HEADER}: *\n  Content-Security-Policy: ${CSP_HEADER}\n`,
  );
});

test("local Astro preview serves the same public-resource header", () => {
  const headers =
    typeof config.server === "object" ? config.server.headers : undefined;
  assert.equal(headers?.[CORS_HEADER], "*");
  assert.equal(headers?.[CSP_HEADER_NAME], CSP_HEADER);
});
