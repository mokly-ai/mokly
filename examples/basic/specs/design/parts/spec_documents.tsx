import { DocumentLink } from "./markdown.js";

/**
 * A written spec beside the billing screens. The overdue invoice it mentions
 * has no depicted state from All, so that link stays an inert label.
 */
export function PaymentTerms() {
  return (
    <>
      <h1>Payment terms</h1>
      <p>When an invoice is due, and what a customer sees once it is late.</p>
      <h2>Due dates</h2>
      <p>
        Every invoice is due 30 days after it is issued. The due date appears
        beside the amount owed, and invoice numbers keep the form{" "}
        <code>INV-1042</code>.
      </p>
      <h2>Overdue invoices</h2>
      <p>
        An invoice becomes overdue the day after its due date. It then shows an
        Overdue badge and a reminder with a Pay now action, as the{" "}
        <DocumentLink>overdue invoice</DocumentLink> shows.
      </p>
      <table>
        <thead>
          <tr>
            <th>Days overdue</th>
            <th>Reminder</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Reminder email</td>
          </tr>
          <tr>
            <td>7</td>
            <td>Second email and a banner on the account</td>
          </tr>
          <tr>
            <td>30</td>
            <td>The account is reviewed before new invoices are issued</td>
          </tr>
        </tbody>
      </table>
      <h2>Payment methods</h2>
      <ul>
        <li>Card</li>
        <li>Bank transfer</li>
      </ul>
    </>
  );
}
