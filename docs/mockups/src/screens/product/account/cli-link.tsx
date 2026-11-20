import { MockLink } from "@mokly/mokly";

import { cliForm } from "../setup-destinations";
import type { Installation } from "../setup-destinations";

/** The words of the line, which a wait draws too. */
const label = "Publish with the CLI instead";

/**
 * The line under the panel that leads to the CLI form. A project needs no
 * repository the App can read: the Mokly CLI publishes any repository, by hand
 * or from CI, so both steps that offer a repository end with this way round
 * the App for every reader who can create a project. The form it opens is the
 * one the reader's workspace reaches, so the caller names the installation.
 * While the workspace read runs, the form's address is not known, so the line
 * draws its words as text with no link, in the box the link takes.
 */
export function PublishWithCli(
  props: { installation: Installation } | { waiting: true },
) {
  return (
    <p className="fo-account-switch">
      {"waiting" in props ? (
        <span className="fo-account-switch-text">{label}</span>
      ) : (
        <MockLink to={cliForm(props.installation)}>{label}</MockLink>
      )}
    </p>
  );
}
