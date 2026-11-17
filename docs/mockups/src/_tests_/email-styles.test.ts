import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { tokens } from "@mokly-cloud/tokens/tokens";

import {
  canonicalScheme,
  canonicalViewport,
  canvasGradient,
  darkOverrideGroup,
  emailStyles,
  mobileOverrideGroup,
  overrideStyles,
} from "../emails/styles";
import type { EmailClass, EmailStyleTable } from "../emails/styles";
import { catalogueRoot } from "./catalogue-paths";
import { schemes, viewports } from "./email-messages";
import { emailColors } from "./emails-policy";

function classNames(table: EmailStyleTable): EmailClass[] {
  return Object.keys(table) as EmailClass[];
}

function rule(name: EmailClass, changed: [string, unknown][]): string {
  return (
    "  ." +
    name +
    " { " +
    changed
      .map(
        ([property, value]) =>
          property.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()) +
          ": " +
          value +
          " !important;",
      )
      .join(" ") +
    " }"
  );
}

function difference(
  from: EmailStyleTable,
  to: EmailStyleTable,
): [EmailClass, [string, unknown][]][] {
  return classNames(from)
    .map((name): [EmailClass, [string, unknown][]] => [
      name,
      Object.entries(to[name]).filter(
        ([property, value]) =>
          (from[name] as Record<string, unknown>)[property] !== value,
      ),
    ])
    .filter(([, changed]) => changed.length > 0);
}

function group(
  query: string,
  from: EmailStyleTable,
  to: EmailStyleTable,
): string {
  return (
    query +
    " {\n" +
    difference(from, to)
      .map(([name, changed]) => rule(name, changed))
      .join("\n") +
    "\n}"
  );
}

test("the message draws the account canvas and card of the application", () => {
  const account = readFileSync(
    resolve(catalogueRoot, "styles/product/account.css"),
    "utf8",
  );
  assert.match(
    account,
    /radial-gradient\(\s*var\(--mk-color-border\) 1px,\s*transparent 1px\s*\)/,
  );
  assert.match(
    account,
    /background-size: var\(--mk-space-6\) var\(--mk-space-6\)/,
  );
  assert.match(account, /box-shadow: var\(--mk-shadow-medium\)/);
  assert.match(account, /border-radius: var\(--mk-radius-medium\)/);
  assert.match(
    account,
    /\.fo-account-mark \{[^}]*margin-bottom: var\(--mk-space-8\)/,
  );
  for (const scheme of schemes) {
    const folio = paletteColors(scheme, "folio");
    const desktop = emailStyles(scheme, "desktop");
    assert.equal(desktop["e-canvas"].backgroundColor, folio.background);
    assert.equal(desktop["e-canvas"].backgroundImage, canvasGradient(scheme));
    assert.equal(desktop["e-canvas"].backgroundSize, "24px 24px");
    assert.ok(canvasGradient(scheme).includes(folio.border));
    assert.equal(desktop["e-card"].backgroundColor, folio.surface);
    assert.equal(desktop["e-card"].borderColor, folio.border);
    assert.equal(desktop["e-card"].borderRadius, tokens.radius.medium);
    assert.equal(desktop["e-card"].boxShadow, tokens.shadow[scheme].medium);
    assert.equal(desktop["e-card"].padding, "40px");
    assert.equal(desktop["e-heading"].paddingTop, "32px");
    assert.equal(desktop["e-logo"].lineHeight, "32px");
  }
});

test("every style table declares the same classes and properties", () => {
  const canonical = emailStyles(canonicalScheme, canonicalViewport);
  for (const scheme of schemes)
    for (const viewport of viewports) {
      const table = emailStyles(scheme, viewport);
      assert.deepEqual(classNames(table), classNames(canonical));
      for (const name of classNames(table))
        assert.deepEqual(
          Object.keys(table[name]),
          Object.keys(canonical[name]),
          name,
        );
    }
});

test("the override block is the difference between the resolved tables", () => {
  const canonical = emailStyles(canonicalScheme, canonicalViewport);
  const dark = emailStyles("dark", canonicalViewport);
  const mobile = emailStyles(canonicalScheme, "mobile");
  assert.equal(
    darkOverrideGroup(),
    group("@media (prefers-color-scheme: dark)", canonical, dark),
  );
  assert.equal(
    mobileOverrideGroup(),
    group(
      "@media (max-width: " + tokens.layout.breakpoint + ")",
      canonical,
      mobile,
    ),
  );
  assert.equal(
    overrideStyles(),
    darkOverrideGroup() + "\n" + mobileOverrideGroup(),
  );
  const palette = emailColors("dark");
  for (const [name, changed] of difference(canonical, dark))
    for (const [property, value] of changed) {
      if (name === "e-logo-light" || name === "e-logo-dark") {
        assert.ok(["display", "msoHide"].includes(property), property);
        continue;
      }
      if (property === "backgroundImage") {
        assert.equal(value, canvasGradient("dark"));
        continue;
      }
      if (property === "boxShadow") {
        assert.equal(value, tokens.shadow.dark.medium);
        continue;
      }
      assert.match(property, /[Cc]olor$/);
      assert.ok(palette.has(String(value)), property + ": " + String(value));
    }
  for (const [name, changed] of difference(canonical, mobile)) {
    assert.ok(["e-canvas", "e-card"].includes(name), name);
    for (const [property, value] of changed)
      if (property.endsWith("Color"))
        assert.ok(emailColors("light").has(String(value)), property);
  }
});

test("the override groups swap the logo and drop the card on a phone", () => {
  assert.match(
    darkOverrideGroup(),
    /\n {2}\.e-logo-light \{ display: none !important; mso-hide: all !important; \}\n/,
  );
  assert.match(
    darkOverrideGroup(),
    /\n {2}\.e-logo-dark \{ display: block !important; mso-hide: none !important; \}\n/,
  );
  assert.doesNotMatch(darkOverrideGroup(), /\.e-logo \{/);
  const mobile = mobileOverrideGroup();
  for (const declaration of [
    "background-image: none !important;",
    "padding: 0 !important;",
    "background-color: transparent !important;",
    "border-radius: 0 !important;",
    "border-width: 0 !important;",
    "box-shadow: none !important;",
    "padding: 32px 20px 48px !important;",
  ])
    assert.ok(mobile.includes(declaration), declaration);
});
