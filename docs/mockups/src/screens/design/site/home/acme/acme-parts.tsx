/**
 * The shared parts of the depicted acme/storefront app: the phone status
 * bar, the logo, the buttons, badges, avatars, switches, fields and the
 * segmented control. They draw another company's product, so every part
 * uses plain text elements: nothing in the app takes focus or names a
 * landmark.
 */

import type { ReactNode } from "react";

import { classNames } from "../../parts/class-names.js";

import { AcmeIcon, type AcmeIconName } from "./acme-icons.js";

/** The phone status bar: the time, the signal, the Wi-Fi and the battery. */
export function AcmeStatus() {
  return (
    <div className="site-acme-status">
      <b>9:41</b>
      <svg
        aria-hidden="true"
        fill="currentColor"
        focusable="false"
        viewBox="0 0 72 13"
      >
        <rect height="4" rx="1" width="3" x="0" y="8.5" />
        <rect height="6" rx="1" width="3" x="5" y="6.5" />
        <rect height="8.5" rx="1" width="3" x="10" y="4" />
        <rect height="11" rx="1" width="3" x="15" y="1.5" />
        <path
          d="M8 10.6 9.6 9a2.3 2.3 0 0 0-3.2 0zM4.6 7.2a4.8 4.8 0 0 1 6.8 0l1.2-1.2a6.5 6.5 0 0 0-9.2 0zM2 4.6a8.5 8.5 0 0 1 12 0l1.2-1.2a10.2 10.2 0 0 0-14.4 0z"
          transform="translate(24 0.5)"
        />
        <rect
          fill="none"
          height="11.8"
          rx="3.6"
          stroke="currentColor"
          strokeWidth="1.2"
          width="24.8"
          x="46.6"
          y="0.6"
        />
        <rect height="7" rx="1.6" width="17.5" x="49" y="3" />
      </svg>
    </div>
  );
}

/** The acme logo: a coffee bean and the serif name. */
export function AcmeLogo() {
  return (
    <span className="site-acme-logo">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 22 22">
        <ellipse
          className="site-acme-logo-bean"
          cx="11"
          cy="11"
          rx="7.4"
          ry="9.6"
          transform="rotate(32 11 11)"
        />
        <path
          className="site-acme-logo-crease"
          d="M8.2 5.6c3.8 2.4 1.9 8.4 5.6 10.8"
        />
      </svg>
      acme
    </span>
  );
}

/** The bag icon with its count of two items. */
export function AcmeCart() {
  return (
    <span className="site-acme-cart">
      <AcmeIcon name="bag" />
      <i>
        <span>2</span>
      </i>
    </span>
  );
}

/** The tone of an acme button. */
type AcmeButtonTone = "danger" | "muted" | "primary" | "secondary";

/** An acme button, drawn as text: `block` fills its row. */
export function AcmeButton({
  block = false,
  children,
  className,
  icon,
  size,
  tone = "primary",
}: {
  block?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
  icon?: AcmeIconName | undefined;
  size?: "large" | "small" | undefined;
  tone?: AcmeButtonTone | undefined;
}) {
  return (
    <span
      className={classNames(
        "site-acme-button",
        `site-acme-button--${tone}`,
        block && "site-acme-button--block",
        size && `site-acme-button--${size}`,
        className,
      )}
    >
      <span className="site-acme-button-label">
        {icon === undefined ? null : <AcmeIcon name={icon} />}
        {children}
      </span>
    </span>
  );
}

/** The tone of an acme badge. */
type AcmeBadgeTone = "muted" | "plum" | "saffron" | "sage";

/** A small pill such as `Most popular`. */
export function AcmeBadge({
  children,
  tone = "saffron",
}: {
  children: ReactNode;
  tone?: AcmeBadgeTone | undefined;
}) {
  return (
    <span className={`site-acme-badge site-acme-badge--${tone}`}>
      <span>{children}</span>
    </span>
  );
}

/** A customer's avatar: initials on a warm gradient. */
export function AcmeAvatar({
  initials,
  size,
  tone = "terra",
}: {
  initials: string;
  size?: "large" | "small" | undefined;
  tone?: "cream" | "plum" | "sage" | "terra" | undefined;
}) {
  return (
    <span
      className={classNames(
        "site-acme-avatar",
        `site-acme-avatar--${tone}`,
        size && `site-acme-avatar--${size}`,
      )}
    >
      <span>{initials}</span>
    </span>
  );
}

/** A switch, on or off. */
function AcmeSwitch({ on = true }: { on?: boolean | undefined }) {
  return (
    <span
      className={classNames("site-acme-switch", on && "site-acme-switch--on")}
    >
      <i />
    </span>
  );
}

/** A row with a label and a switch, as settings list them. */
export function AcmeToggleRow({
  label,
  on = true,
}: {
  label: string;
  on?: boolean | undefined;
}) {
  return (
    <div className="site-acme-toggle-row">
      <span>{label}</span>
      <AcmeSwitch on={on} />
    </div>
  );
}

/** A labelled field with its value, in its rest, focus or error state. */
export function AcmeField({
  icon,
  label,
  muted = false,
  note,
  state,
  trail,
  value,
}: {
  icon?: AcmeIconName | undefined;
  label: string;
  muted?: boolean | undefined;
  note?: string | undefined;
  state?: "error" | "focus" | undefined;
  trail?: ReactNode | undefined;
  value: string;
}) {
  return (
    <div className="site-acme-field">
      <span className="site-acme-field-label">{label}</span>
      <span
        className={classNames(
          "site-acme-input",
          state && `site-acme-input--${state}`,
        )}
      >
        {icon === undefined ? null : <AcmeIcon name={icon} />}
        <span
          className={classNames(
            "site-acme-input-value",
            muted && "site-acme-input-value--muted",
          )}
        >
          {value}
        </span>
        {trail}
      </span>
      {note === undefined ? null : (
        <span className="site-acme-field-note">{note}</span>
      )}
    </div>
  );
}

/** The Monthly and Yearly switch of the pricing pages. */
export function AcmeSegmented() {
  return (
    <span className="site-acme-segmented">
      <span className="site-acme-segmented-on">Monthly</span>
      <span>Yearly</span>
    </span>
  );
}
