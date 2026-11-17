/**
 * The table subtree every message shares and the standalone document delivered
 * around it. The catalogue screens render the subtree with fixture content and
 * the generated document's own scheme and viewport; the template generator
 * renders the document with placeholder content, prefixing the doctype. Both
 * supply the root the logo is served beneath, which is the only address a
 * message resolves that its content does not carry.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { EmailKind } from "./content";
import {
  canonicalScheme,
  canonicalViewport,
  emailStyles,
  logoHeight,
  logoWidth,
  overrideStyles,
} from "./styles";
import type { EmailStyleTable } from "./styles";
import type {
  TokenColorScheme,
  TokenViewport,
} from "@mokly-cloud/tokens/tokens";

/** The published logo, one lockup for each scheme, drawn as the brand. */
export const logoFiles = {
  dark: "mokly-logo-dark.png",
  light: "mokly-logo-light.png",
} as const;

/** What a message's own body receives: its content and the resolved styles. */
export interface EmailBodyRenderProps<Content> {
  content: Content;
  styles: EmailStyleTable;
}

/** One delivered message: its lines, its text alternative and its body. */
export interface EmailDefinition<Content> {
  Body: (props: EmailBodyRenderProps<Content>) => ReactElement;
  kind: EmailKind;
  preheader: (content: Content) => string;
  subject: (content: Content) => string;
  text: (content: Content) => string;
}

const collapse: CSSProperties = { borderCollapse: "collapse" };

/**
 * The brand: the published logo, mark and wordmark as one artwork. Mail
 * clients strip inline SVG and substitute their own serif for a text
 * wordmark, so the lockup is an image; both scheme variants are sent and the
 * style table shows one of them, and a client that blocks images shows the
 * product's name in its place. The images carry `fetchPriority="low"`
 * because React hoists a preload `link` above an image without it, and the
 * document carries no `link` at all.
 */
function BrandRow({
  brandRoot,
  styles,
}: {
  brandRoot: string;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-logo" style={styles["e-logo"]}>
        <img
          alt="Mokly"
          className="e-logo-light"
          fetchPriority="low"
          height={logoHeight}
          src={brandRoot + logoFiles.light}
          style={styles["e-logo-light"]}
          width={logoWidth}
        />
        <img
          alt="Mokly"
          className="e-logo-dark"
          fetchPriority="low"
          height={logoHeight}
          src={brandRoot + logoFiles.dark}
          style={styles["e-logo-dark"]}
          width={logoWidth}
        />
      </td>
    </tr>
  );
}

/** The message's one heading, and the document's one primary heading. */
export function HeadingRow({
  children,
  styles,
}: {
  children: ReactNode;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-heading" style={styles["e-heading"]}>
        <h1 className="e-title" style={styles["e-title"]}>
          {children}
        </h1>
      </td>
    </tr>
  );
}

/** One sentence of body copy, for the kind that has one. */
export function TextRow({
  children,
  styles,
}: {
  children: ReactNode;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-text" style={styles["e-text"]}>
        {children}
      </td>
    </tr>
  );
}

/** The one action, in the only cell the message fills with the accent. */
export function ActionRow({
  href,
  label,
  styles,
}: {
  href: string;
  label: string;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-action" style={styles["e-action"]}>
        <table
          border={0}
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={collapse}
        >
          <tbody>
            <tr>
              <td className="e-action-fill" style={styles["e-action-fill"]}>
                <a
                  className="e-action-link"
                  href={href}
                  style={styles["e-action-link"]}
                >
                  {label}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

/** The link written out, for a reader whose client will not open the action. */
export function FallbackRow({
  href,
  styles,
}: {
  href: string;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-note" style={styles["e-note"]}>
        Or open this link:
        <br />
        <a className="e-link" href={href} style={styles["e-link"]}>
          {href}
        </a>
      </td>
    </tr>
  );
}

/** One line of small print beneath the link. */
export function ExpiryRow({
  children,
  styles,
}: {
  children: ReactNode;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-expiry" style={styles["e-expiry"]}>
        {children}
      </td>
    </tr>
  );
}

/** The message itself: canvas, 600px column, one card and its blocks. */
export function EmailBody<Content>({
  brandRoot,
  colorScheme,
  content,
  email,
  viewport,
}: {
  brandRoot: string;
  colorScheme: TokenColorScheme;
  content: Content;
  email: EmailDefinition<Content>;
  viewport: TokenViewport;
}) {
  const styles = emailStyles(colorScheme, viewport);
  return (
    <table
      border={0}
      cellPadding={0}
      cellSpacing={0}
      className="e-frame"
      data-mkc-email={email.kind}
      role="presentation"
      style={styles["e-frame"]}
      width="100%"
    >
      <tbody>
        <tr>
          <td align="center" className="e-canvas" style={styles["e-canvas"]}>
            <table
              border={0}
              cellPadding={0}
              cellSpacing={0}
              className="e-message"
              role="presentation"
              style={styles["e-message"]}
              width="600"
            >
              <tbody>
                <tr>
                  <td className="e-card" style={styles["e-card"]}>
                    <table
                      border={0}
                      cellPadding={0}
                      cellSpacing={0}
                      className="e-blocks"
                      role="presentation"
                      style={styles["e-blocks"]}
                      width="100%"
                    >
                      <tbody>
                        <BrandRow brandRoot={brandRoot} styles={styles} />
                        <email.Body content={content} styles={styles} />
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** The complete delivered document, inlining light desktop with overrides. */
export function EmailDocument<Content>({
  brandRoot,
  content,
  email,
}: {
  brandRoot: string;
  content: Content;
  email: EmailDefinition<Content>;
}) {
  const styles = emailStyles(canonicalScheme, canonicalViewport);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>{email.subject(content)}</title>
        <style>{overrideStyles()}</style>
      </head>
      <body className="e-body" style={styles["e-body"]}>
        <div className="e-preheader" style={styles["e-preheader"]}>
          {email.preheader(content)}
        </div>
        <EmailBody
          brandRoot={brandRoot}
          colorScheme={canonicalScheme}
          content={content}
          email={email}
          viewport={canonicalViewport}
        />
      </body>
    </html>
  );
}
