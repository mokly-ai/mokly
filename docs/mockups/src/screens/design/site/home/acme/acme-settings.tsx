/**
 * The depicted acme `account/settings` screen on a desktop, in the dark
 * scheme: the account menu beside the profile, the notifications, the saved
 * cards and Close account.
 */

import { AcmeIcon, type AcmeIconName } from "./acme-icons.js";
import {
  AcmeAvatar,
  AcmeBadge,
  AcmeButton,
  AcmeLogo,
  AcmeToggleRow,
} from "./acme-parts.js";

const MENU: ReadonlyArray<readonly [AcmeIconName, string]> = [
  ["box", "Orders"],
  ["repeat", "Subscription"],
  ["card", "Payment"],
  ["pin", "Addresses"],
  ["gear", "Settings"],
];

/** `account/settings` on a desktop, dark. */
export function AcmeSettings() {
  return (
    <div className="site-acme site-acme--desktop site-acme--dark site-acme-settings">
      <div className="site-acme-settings-menu">
        <AcmeLogo />
        <span className="site-acme-settings-links">
          {MENU.map(([icon, label]) => (
            <span
              className={
                label === "Settings" ? "site-acme-settings-on" : undefined
              }
              key={label}
            >
              <AcmeIcon name={icon} />
              {label}
            </span>
          ))}
        </span>
      </div>
      <div className="site-acme-settings-body">
        <div className="site-acme-title site-acme-title--large">
          Account settings
        </div>
        <div className="site-acme-settings-grid">
          <div className="site-acme-panel">
            <div className="site-acme-panel-title">Profile</div>
            <div className="site-acme-profile">
              <AcmeAvatar initials="JE" size="large" />
              <span className="site-acme-lines">
                <b>Jordan Ellis</b>
                <i>jordan@example.com</i>
              </span>
              <AcmeButton size="small" tone="secondary">
                Edit
              </AcmeButton>
            </div>
          </div>
          <div className="site-acme-panel">
            <div className="site-acme-panel-title">Notifications</div>
            <AcmeToggleRow label="Roast day emails" />
            <AcmeToggleRow label="Shipping updates" />
            <AcmeToggleRow label="Brew guide newsletter" on={false} />
          </div>
          <div className="site-acme-panel">
            <div className="site-acme-panel-title">Saved cards</div>
            <div className="site-acme-saved">
              <AcmeIcon name="card" />
              <span className="site-acme-lines">
                <b>Card ending 4242</b>
                <i>Expires 08/28</i>
              </span>
              <AcmeBadge tone="sage">Default</AcmeBadge>
            </div>
            <div className="site-acme-saved">
              <AcmeIcon name="card" />
              <span className="site-acme-lines">
                <b>Card ending 1881</b>
                <i>Expires 02/27</i>
              </span>
              <span className="site-acme-link">Remove</span>
            </div>
          </div>
          <div className="site-acme-panel">
            <div className="site-acme-panel-title">Close account</div>
            <div className="site-acme-sub">
              Your subscription stops at the end of the month.
            </div>
            <AcmeButton className="site-acme-close" tone="danger">
              Delete account
            </AcmeButton>
          </div>
        </div>
      </div>
    </div>
  );
}
