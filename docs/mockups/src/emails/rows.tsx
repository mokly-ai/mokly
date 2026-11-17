import type { CSSProperties, ReactNode } from "react";

import type { EmailStyleTable } from "./styles";

const collapse: CSSProperties = { borderCollapse: "collapse" };

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
