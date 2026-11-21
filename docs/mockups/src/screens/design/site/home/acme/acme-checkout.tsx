/**
 * The depicted acme checkout at its phone size: `checkout/payment`, in the
 * light or the dark scheme, and `checkout/review-order`, dark. The order
 * lines and the totals are shared with the desktop payment screen.
 */

import { classNames } from "../../parts/class-names.js";

import { AcmeTile } from "./acme-bag.js";
import { AcmeIcon } from "./acme-icons.js";
import {
  AcmeButton,
  AcmeField,
  AcmeStatus,
  AcmeToggleRow,
} from "./acme-parts.js";

/** The phone's top bar of a checkout step, such as `Checkout 2 of 3`. */
function CheckoutBar({ step }: { step: 2 | 3 }) {
  return (
    <>
      <div className="site-acme-checkout-bar">
        <AcmeIcon name="back" />
        <b>Checkout</b>
        <span>{step} of 3</span>
      </div>
      <div className="site-acme-steps">
        {[1, 2, 3].map((index) => (
          <i
            className={
              index < step
                ? "site-acme-steps-done"
                : index === step
                  ? "site-acme-steps-on"
                  : undefined
            }
            key={index}
          />
        ))}
      </div>
    </>
  );
}

/** The two bags of the order, each with its grind and price. */
export function AcmeOrderLines() {
  return (
    <div className="site-acme-items">
      <div className="site-acme-item">
        <AcmeTile roast="guji" size="medium" />
        <span className="site-acme-lines">
          <b>Guji, Ethiopia</b>
          <i>250 g · Whole bean</i>
        </span>
        <b>$19.00</b>
      </div>
      <div className="site-acme-item">
        <AcmeTile roast="huila" size="medium" />
        <span className="site-acme-lines">
          <b>Huila, Colombia</b>
          <i>250 g · Filter grind</i>
        </span>
        <b>$21.00</b>
      </div>
    </div>
  );
}

/** The lines above the total, each a label and an amount. */
type TotalLines = ReadonlyArray<readonly [string, string]>;

const SUBTOTAL: TotalLines = [
  ["Subtotal", "$40.00"],
  ["Shipping", "$2.00"],
];

/** The lines above the total, then the total of the order. */
export function AcmeTotals({ lines = SUBTOTAL }: { lines?: TotalLines }) {
  const rows = lines;
  return (
    <div className="site-acme-totals">
      {rows.map(([label, value]) => (
        <span key={label}>
          {label}
          <span>{value}</span>
        </span>
      ))}
      <span className="site-acme-totals-sum">
        Total
        <span>$42.00</span>
      </span>
    </div>
  );
}

/** The card, wallet and bank choice, with Card chosen. */
export function AcmeMethods({ large = false }: { large?: boolean }) {
  return (
    <div
      className={classNames(
        "site-acme-methods",
        large && "site-acme-methods--large",
      )}
    >
      <span className="site-acme-methods-on">
        <AcmeIcon name="card" />
        Card
      </span>
      <span>
        <AcmeIcon name="wallet" />
        Wallet
      </span>
      <span>
        <AcmeIcon name="bank" />
        Bank
      </span>
    </div>
  );
}

/** The card fields, Save card and Pay, as both payment screens draw them. */
export function AcmeCardForm() {
  return (
    <>
      <AcmeField
        icon="card"
        label="Card number"
        state="focus"
        value="4242 4242 4242 4242"
      />
      <div className="site-acme-pair">
        <AcmeField label="Expiry" value="08 / 28" />
        <AcmeField label="CVC" value="•••" />
      </div>
      <AcmeToggleRow label="Save card for next time" />
      <AcmeButton block className="site-acme-pay" icon="lock" size="large">
        Pay $42.00
      </AcmeButton>
    </>
  );
}

/** `checkout/payment` on a phone. */
export function AcmePaymentPhone({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={classNames(
        "site-acme site-acme--phone",
        dark && "site-acme--dark",
      )}
    >
      <AcmeStatus />
      <CheckoutBar step={2} />
      <div className="site-acme-checkout">
        <div className="site-acme-mini-summary">
          <AcmeTile roast="guji" size="small" />
          <AcmeTile roast="huila" size="small" />
          <span className="site-acme-lines">
            <b>2 items</b>
            <i>Guji, Huila</i>
          </span>
          <b>$42.00</b>
        </div>
        <div className="site-acme-title">Payment</div>
        <AcmeMethods />
        <AcmeCardForm />
      </div>
    </div>
  );
}

/** `checkout/review-order` on a phone, in the dark scheme. */
export function AcmeReviewOrder() {
  return (
    <div className="site-acme site-acme--phone site-acme--dark">
      <AcmeStatus />
      <CheckoutBar step={3} />
      <div className="site-acme-checkout">
        <div className="site-acme-title">Review order</div>
        <AcmeOrderLines />
        <div className="site-acme-line-card">
          <AcmeIcon name="pin" />
          <span className="site-acme-lines">
            <i>Deliver to</i>
            <b>12 Harbour Street, Leith</b>
          </span>
        </div>
        <div className="site-acme-line-card">
          <AcmeIcon name="card" />
          <span className="site-acme-lines">
            <i>Pay with</i>
            <b>Card ending 4242</b>
          </span>
        </div>
        <AcmeTotals />
        <AcmeButton block className="site-acme-pay" size="large">
          Place order
        </AcmeButton>
      </div>
    </div>
  );
}
