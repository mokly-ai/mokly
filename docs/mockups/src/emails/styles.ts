/**
 * The literal styles a delivered message inlines. Mail clients read neither
 * custom properties nor a linked stylesheet, so every value is resolved from
 * the shared tokens here, for one scheme and one viewport. The color roles are
 * bound through the Folio palette the application scopes, so the message is the
 * account panel on the account canvas. Light at desktop is what the document
 * inlines; the two override groups below carry the dark palette and the mobile
 * composition for the clients that honor the queries.
 * Token lengths use a 16px root and become pixels before either composition,
 * because classic Outlook does not support rem units.
 */

import type { CSSProperties } from "react";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { tokens } from "@mokly-cloud/tokens/tokens";
import type {
  TokenColorScheme,
  TokenViewport,
} from "@mokly-cloud/tokens/tokens";

/** Every class the email carries. Each exists only for the override block. */
export type EmailClass =
  | "e-body"
  | "e-preheader"
  | "e-frame"
  | "e-canvas"
  | "e-message"
  | "e-card"
  | "e-blocks"
  | "e-logo"
  | "e-logo-light"
  | "e-logo-dark"
  | "e-heading"
  | "e-title"
  | "e-text"
  | "e-action"
  | "e-action-fill"
  | "e-action-link"
  | "e-note"
  | "e-link"
  | "e-expiry";

/**
 * One class's resolved declarations. `msoHide` is the visibility Word's engine
 * reads, which the standard property set does not name; React writes it out as
 * `mso-hide` beside the others.
 */
export type EmailStyle = CSSProperties & { msoHide?: "all" | "none" };

/** One resolved style table: the same classes and properties in every case. */
export type EmailStyleTable = Readonly<Record<EmailClass, EmailStyle>>;

/** The scheme and viewport the delivered document inlines before overrides. */
export const canonicalScheme: TokenColorScheme = "light";
/** The viewport the delivered document inlines before the mobile override. */
export const canonicalViewport: TokenViewport = "desktop";

/** The width the published logo is drawn at: its 3:1 canvas at 32px tall. */
export const logoWidth = 96;
/** The height the published logo is drawn at, the product wordmark's own. */
export const logoHeight = 32;
/**
 * The logo cell's line height: `space.8`, the logo's own height, so a client
 * that blocks images keeps the row at the logo's height around the alternative
 * text instead of clipping it.
 */
const logoLine = tokens.space[8];

type TypeRole = keyof typeof tokens.type;

function typeStyle(role: TypeRole, viewport: TokenViewport): CSSProperties {
  const scale = tokens.type[role];
  return {
    fontSize: scale[viewport][0],
    fontWeight: scale.weight,
    lineHeight: scale[viewport][1],
  };
}

/** The account canvas's dotted grid, over the scheme's own hairline color. */
export function canvasGradient(scheme: TokenColorScheme): string {
  const { border } = paletteColors(scheme, "folio");
  return "radial-gradient(" + border + " 1px, transparent 1px)";
}

/**
 * One scheme's logo: a block when it is the scheme's own, hidden from every
 * engine when it is the other's. The border is named so a client that frames
 * a blocked image draws nothing around the alternative text.
 */
function logo(shown: boolean): EmailStyle {
  return {
    border: 0,
    display: shown ? "block" : "none",
    msoHide: shown ? "none" : "all",
  };
}

/** Resolve every email style for one generated scheme and viewport. */
export function emailStyles(
  scheme: TokenColorScheme,
  viewport: TokenViewport,
): EmailStyleTable {
  const color = tokens.color[scheme];
  const folio = paletteColors(scheme, "folio");
  const desktop = viewport === "desktop";
  const styles: EmailStyleTable = {
    "e-body": {
      backgroundColor: folio.background,
      color: folio.text,
      fontFamily: tokens.font.sans,
      margin: tokens.space[0],
      padding: tokens.space[0],
    },
    "e-preheader": {
      color: "transparent",
      display: "none",
      fontSize: "1px",
      height: tokens.space[0],
      lineHeight: "1px",
      maxHeight: tokens.space[0],
      opacity: 0,
      overflow: "hidden",
      visibility: "hidden",
    },
    "e-frame": {
      backgroundColor: folio.background,
      borderCollapse: "collapse",
      width: "100%",
    },
    "e-canvas": {
      backgroundColor: folio.background,
      backgroundImage: desktop ? canvasGradient(scheme) : "none",
      backgroundSize: tokens.space[6] + " " + tokens.space[6],
      padding: desktop ? tokens.space[10] : tokens.space[0],
      verticalAlign: "top",
    },
    "e-message": {
      borderCollapse: "separate",
      borderSpacing: 0,
      maxWidth: "600px",
      width: "100%",
    },
    "e-card": {
      backgroundColor: desktop ? folio.surface : "transparent",
      borderColor: folio.border,
      borderRadius: desktop ? tokens.radius.medium : tokens.space[0],
      borderStyle: "solid",
      borderWidth: desktop ? "1px" : tokens.space[0],
      boxShadow: desktop ? tokens.shadow[scheme].medium : "none",
      padding: desktop
        ? tokens.space[10]
        : tokens.space[8] +
          " " +
          tokens.layout.gutterMobile +
          " " +
          tokens.space[12],
    },
    "e-blocks": { borderCollapse: "collapse", width: "100%" },
    "e-logo": { lineHeight: logoLine },
    "e-logo-light": logo(scheme === "light"),
    "e-logo-dark": logo(scheme === "dark"),
    "e-heading": { paddingTop: tokens.space[8] },
    "e-title": {
      color: folio.text,
      fontFamily: tokens.font.sans,
      ...typeStyle("heading3", viewport),
      letterSpacing: "-0.02em",
      margin: tokens.space[0],
    },
    "e-text": {
      color: folio.text,
      fontFamily: tokens.font.sans,
      ...typeStyle("body", viewport),
      paddingTop: tokens.space[4],
    },
    "e-action": { paddingTop: tokens.space[8] },
    "e-action-fill": {
      backgroundColor: color.accentSolid,
      borderRadius: tokens.radius.chrome,
    },
    "e-action-link": {
      color: color.onAccent,
      display: "inline-block",
      fontFamily: tokens.font.sans,
      ...typeStyle("uiTitle", viewport),
      padding: tokens.space[3] + " " + tokens.space[6],
      textDecoration: "none",
    },
    "e-note": {
      color: folio.textMuted,
      fontFamily: tokens.font.sans,
      ...typeStyle("small", viewport),
      overflowWrap: "anywhere",
      paddingTop: tokens.space[8],
    },
    "e-link": {
      color: color.accent,
      overflowWrap: "anywhere",
      textDecoration: "underline",
    },
    "e-expiry": {
      color: folio.textMuted,
      fontFamily: tokens.font.sans,
      ...typeStyle("small", viewport),
      paddingTop: tokens.space[3],
    },
  };
  for (const style of Object.values(styles))
    Object.assign(
      style,
      Object.fromEntries(
        entries(style).map(([key, value]) => [
          key,
          typeof value === "string"
            ? value.replace(
                /(-?\d*\.?\d+)rem\b/g,
                (_, amount: string) => `${Number(amount) * 16}px`,
              )
            : value,
        ]),
      ),
    );
  return styles;
}

function property(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}

function entries(style: EmailStyle): [string, string | number][] {
  return Object.entries(style) as [string, string | number][];
}

/** Every declaration one table changes against another, class by class. */
export function styleDifference(
  from: EmailStyleTable,
  to: EmailStyleTable,
): [EmailClass, [string, string | number][]][] {
  return (Object.keys(from) as EmailClass[])
    .map((name): [EmailClass, [string, string | number][]] => [
      name,
      entries(to[name]).filter(
        ([key, value]) =>
          entries(from[name]).find(([other]) => other === key)?.[1] !== value,
      ),
    ])
    .filter(([, changed]) => changed.length > 0);
}

function group(
  query: string,
  difference: readonly [EmailClass, [string, string | number][]][],
): string {
  const rules = difference.map(
    ([name, changed]) =>
      "  ." +
      name +
      " { " +
      changed
        .map(([key, value]) => property(key) + ": " + value + " !important;")
        .join(" ") +
      " }",
  );
  return query + " {\n" + rules.join("\n") + "\n}";
}

/** The dark palette and its logo, for a client that reads the scheme query. */
export function darkOverrideGroup(): string {
  return group(
    "@media (prefers-color-scheme: dark)",
    styleDifference(
      emailStyles(canonicalScheme, canonicalViewport),
      emailStyles("dark", canonicalViewport),
    ),
  );
}

/** The mobile composition, for a client that reads the width query. */
export function mobileOverrideGroup(): string {
  return group(
    "@media (max-width: " + tokens.layout.breakpoint + ")",
    styleDifference(
      emailStyles(canonicalScheme, canonicalViewport),
      emailStyles(canonicalScheme, "mobile"),
    ),
  );
}

/** The complete style block the delivered document carries in its head. */
export function overrideStyles(): string {
  return darkOverrideGroup() + "\n" + mobileOverrideGroup();
}
