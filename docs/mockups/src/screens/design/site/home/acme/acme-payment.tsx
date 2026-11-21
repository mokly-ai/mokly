/**
 * The depicted acme `checkout/payment` screen on a desktop, in the two
 * versions that the home's Browse frame compares: the plain form on `main`,
 * and the redesigned step with the stepper, the payment methods and the
 * order summary card on `feat/checkout-v2`.
 */

import {
  AcmeCardForm,
  AcmeMethods,
  AcmeOrderLines,
  AcmeTotals,
} from "./acme-checkout.js";
import { AcmeIcon } from "./acme-icons.js";
import { AcmeButton, AcmeField, AcmeLogo } from "./acme-parts.js";

/** The checkout steps of the redesign, with Payment current. */
function Stepper() {
  return (
    <span className="site-acme-stepper">
      <span className="site-acme-stepper-done">
        <AcmeIcon name="check" />
        Bag
      </span>
      <i />
      <span className="site-acme-stepper-on">
        <em>
          <b>2</b>
        </em>
        Payment
      </span>
      <i />
      <span>
        <em>3</em>
        Review
      </span>
    </span>
  );
}

/** The payment step on `main`, before the redesign. */
function PaymentBefore() {
  return (
    <div className="site-acme site-acme--desktop site-acme-before">
      <div className="site-acme-desktop-nav site-acme-desktop-nav--plain">
        <AcmeLogo />
        <b>Checkout</b>
        <AcmeIcon name="bag" />
      </div>
      <div className="site-acme-checkout-desktop site-acme-checkout-desktop--before">
        <div>
          <div className="site-acme-heading">Payment details</div>
          <AcmeField label="Card number" value="4242 4242 4242 4242" />
          <AcmeField label="Expiry date" value="08 / 28" />
          <AcmeField label="Security code" value="•••" />
          <AcmeField label="Name on card" value="Jordan Ellis" />
          <AcmeButton block size="large" tone="muted">
            Continue
          </AcmeButton>
        </div>
        <div className="site-acme-summary site-acme-summary--plain">
          <div className="site-acme-summary-title">Order summary</div>
          <AcmeTotals
            lines={[
              ["Guji, Ethiopia × 1", "$19.00"],
              ["Huila, Colombia × 1", "$21.00"],
              ["Shipping", "$2.00"],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/** The payment step on `feat/checkout-v2`, after the redesign. */
function PaymentAfter() {
  return (
    <div className="site-acme site-acme--desktop">
      <div className="site-acme-desktop-nav site-acme-desktop-nav--plain">
        <AcmeLogo />
        <Stepper />
        <span className="site-acme-secure">
          <AcmeIcon name="lock" />
          Secure checkout
        </span>
      </div>
      <div className="site-acme-checkout-desktop">
        <div>
          <div className="site-acme-title site-acme-title--large">Payment</div>
          <div className="site-acme-sub">Choose how you would like to pay.</div>
          <AcmeMethods large />
          <AcmeCardForm />
        </div>
        <div className="site-acme-summary">
          <div className="site-acme-summary-title">Order summary</div>
          <AcmeOrderLines />
          <AcmeField
            label="Gift card or code"
            muted
            trail={<span className="site-acme-apply">Apply</span>}
            value="Enter code"
          />
          <AcmeTotals />
        </div>
      </div>
    </div>
  );
}

/** `checkout/payment` on a desktop, on `main` or on the branch. */
export function AcmePaymentDesktop({
  version,
}: {
  version: "branch" | "main";
}) {
  return version === "main" ? <PaymentBefore /> : <PaymentAfter />;
}
