/**
 * The depicted acme `onboarding/welcome` screen at its phone size: a
 * saffron art panel with three bags under a sun, then the welcome copy, the
 * brew choices and Continue.
 */

import { AcmeBag, AcmeBeans } from "./acme-bag.js";
import { AcmeIcon } from "./acme-icons.js";
import { AcmeButton, AcmeStatus } from "./acme-parts.js";

const BREWS = ["Filter", "Espresso", "Cold brew", "French press"] as const;

/** The welcome screen of the coffee shop's onboarding. */
export function AcmeWelcome() {
  return (
    <div className="site-acme site-acme--phone">
      <div className="site-acme-welcome-art">
        <AcmeStatus />
        <span className="site-acme-welcome-sun" />
        <AcmeBag
          className="site-acme-welcome-bag site-acme-welcome-bag--left"
          roast="huila"
        />
        <AcmeBag
          className="site-acme-welcome-bag site-acme-welcome-bag--centre"
          roast="guji"
        />
        <AcmeBag
          className="site-acme-welcome-bag site-acme-welcome-bag--right"
          roast="nyeri"
        />
        <AcmeBeans />
      </div>
      <div className="site-acme-welcome-body">
        <span className="site-acme-dots">
          <i className="site-acme-dots-on" />
          <i />
          <i />
        </span>
        <div className="site-acme-title">Welcome to Acme</div>
        <div className="site-acme-sub">
          Coffee roasted to order and sent to your door.
        </div>
        <div className="site-acme-label">How do you brew?</div>
        <div className="site-acme-chips">
          {BREWS.map((brew, index) => (
            <span
              className={index === 0 ? "site-acme-chips-on" : undefined}
              key={brew}
            >
              <span>
                {index === 0 ? <AcmeIcon name="check" /> : null}
                {brew}
              </span>
            </span>
          ))}
        </div>
        <AcmeButton block>Continue</AcmeButton>
        <span className="site-acme-link">I already have an account</span>
      </div>
    </div>
  );
}
