/** Invoice lines, identical in both versions so they line up in an overlay. */
const INVOICE_LINES = [
  ["Team plan, March", "$200.00"],
  ["Two extra seats", "$40.00"],
  ["Amount due", "$240.00"],
] as const;

/**
 * Miniature depiction of the Invoice screen that moved under Account. The
 * revision rewords the due date and the action in place, so every other line
 * keeps its position in both versions of a comparison.
 */
export function MiniInvoice({
  compact,
  revised,
}: {
  compact?: boolean | undefined;
  revised?: boolean | undefined;
}) {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">
          {compact ? "Menu" : "Account · Billing"}
        </div>
        <h2>Invoice INV-1042</h2>
        <p>{revised ? "Due in 14 days" : "Due on 14 March"}</p>
        <dl className="mbk-shot-lines">
          {INVOICE_LINES.map(([item, amount]) => (
            <div key={item}>
              <dt>{item}</dt>
              <dd>{amount}</dd>
            </div>
          ))}
        </dl>
        <span className="mbk-shot-action">
          {revised ? "Pay invoice" : "Pay now"}
        </span>
      </div>
    </div>
  );
}
