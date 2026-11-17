/**
 * The table subtree every message shares and the standalone document delivered
 * around it. The catalogue screens render the subtree with fixture content and
 * the generated document's own scheme and viewport; the template generator
 * renders the document with placeholder content, prefixing the doctype. Both
 * supply the root the logo is served beneath, which is the only address a
 * message resolves that its content does not carry.
 */

import type {
  TokenColorScheme,
  TokenViewport,
} from "@mokly-cloud/tokens/tokens";
import type { ReactElement } from "react";

import { BrandRow } from "./brand";
import type { EmailKind } from "./content";
import {
  canonicalScheme,
  canonicalViewport,
  emailStyles,
  overrideStyles,
} from "./styles";
import type { EmailStyleTable } from "./styles";

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
