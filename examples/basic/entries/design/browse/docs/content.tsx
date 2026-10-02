import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import type { DesignDestination } from "../../parts/destinations.js";
import { NAMING_GUIDE, WELCOME_SPECIFICATION } from "../../parts/docs.js";

/**
 * A doc as the default renderer's reading stylesheet presents it: the view's
 * own surface and ink for the scheme it was rendered in, around one centred
 * reading column. Headings carry the ids the renderer generates for them.
 */
function ReadingView({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <article className={dark ? "mbk-doc-view mbk-screen-dark" : "mbk-doc-view"}>
      <div className="mbk-doc-column">{children}</div>
    </article>
  );
}

/** Welcome's states, as the doc's Markdown table renders them. */
const WELCOME_STATES = [
  ["Default", "A name is entered", "View details"],
  ["Empty workspace", "No name yet", "Create workspace, disabled"],
  ["Save failed", "Saving did not finish", "Try again"],
] as const;

/**
 * The specification doc beside the example screens, in the scheme its view was
 * rendered for. Its one catalogue link opens the screen it describes.
 */
export function WelcomeSpecification({
  dark,
  welcome,
}: {
  dark: boolean;
  welcome: DesignDestination;
}) {
  return (
    <ReadingView dark={dark}>
      <h1 id="welcome-specification">{WELCOME_SPECIFICATION.title}</h1>
      <p>
        The Welcome screen is the first thing a new reader sees. It names the
        product, asks for a workspace name, and points to the details that
        explain the rest of the catalogue.
      </p>
      <h2 id="what-the-screen-shows">What the screen shows</h2>
      <ul>
        <li>A heading that greets the reader by product name.</li>
        <li>
          A workspace name field with the placeholder{" "}
          <code>Name this workspace</code>.
        </li>
        <li>A primary action that opens the details screen.</li>
        <li>A link to the handbook for readers who want the whole tour.</li>
      </ul>
      <h2 id="states">States</h2>
      <table>
        <thead>
          <tr>
            <th>State</th>
            <th>Shown when</th>
            <th>Main action</th>
          </tr>
        </thead>
        <tbody>
          {WELCOME_STATES.map(([state, shown, action]) => (
            <tr key={state}>
              <td>{state}</td>
              <td>{shown}</td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        See the screen in the catalogue:{" "}
        <MockLink to={welcome}>Open the Welcome screen</MockLink>
      </p>
    </ReadingView>
  );
}

/**
 * The removed Naming guide as it read before this branch. Only its light view
 * was captured, and its link, like every link in a previous version, does
 * nothing.
 */
export function NamingGuide() {
  return (
    <ReadingView>
      <h1 id="naming-guide">{NAMING_GUIDE.title}</h1>
      <p>Every workspace needs a name before the catalogue can save it.</p>
      <h2 id="choosing-a-name">Choosing a name</h2>
      <ul>
        <li>Keep it short enough to read in the page header.</li>
        <li>Use letters, numbers, and spaces.</li>
        <li>Choose a name no other workspace uses.</li>
      </ul>
      <p>
        See the screen in the catalogue:{" "}
        <span className="mbk-doc-link">Open the Welcome screen</span>
      </p>
    </ReadingView>
  );
}
