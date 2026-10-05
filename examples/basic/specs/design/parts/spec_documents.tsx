import { DESTINATIONS } from "./destinations.js";
import { DocumentLink } from "./markdown.js";

/**
 * The Example folder's README, the folder's own page. Its first heading is its
 * title, so the folder takes the same title and its row reads Overview. Each
 * link names an entry in the folder and opens the state that depicts it.
 */
export function ExampleReadme() {
  return (
    <>
      <h1>Example</h1>
      <p>
        A small product that shows how screens, a tour, and written notes read
        side by side in one catalogue.
      </p>
      <h2>In this folder</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>What it covers</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <DocumentLink to={DESTINATIONS.welcome}>Welcome</DocumentLink>
            </td>
            <td>The landing screen, with its empty and failed-save states</td>
          </tr>
          <tr>
            <td>
              <DocumentLink to={DESTINATIONS.details}>Details</DocumentLink>
            </td>
            <td>The screen a reader opens from Welcome</td>
          </tr>
          <tr>
            <td>
              <DocumentLink to={DESTINATIONS.tour}>Example tour</DocumentLink>
            </td>
            <td>Welcome and Details in the order a reader meets them</td>
          </tr>
          <tr>
            <td>
              <DocumentLink to={DESTINATIONS.page}>
                Getting started
              </DocumentLink>
            </td>
            <td>Notes for anyone new to the example</td>
          </tr>
        </tbody>
      </table>
      <h2>Conventions</h2>
      <ul>
        <li>
          Keep a screen&apos;s states as its variants, so they stay together in
          the navigation.
        </li>
        <li>
          Say why each state exists in its description. Reviewers read it in
          Details.
        </li>
      </ul>
    </>
  );
}

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
