import { MockLink } from "@mokly/mokly";
import type { ReactNode } from "react";

import { site } from "../../../fixtures/site";
import { Account, AccountPlaceholder, Brand, SiteBrand } from "../navigation";
import { Pending } from "../page-parts";
import { TextBar } from "../placeholders";
import { SetupProgress } from "./setup-progress";
import type { SetupStep } from "./setup-progress";

/**
 * Who the header names on the right: the signed-in person, one quiet link, or
 * nobody. Sign in and sign up carry their switch inside the panel, so their
 * header holds nothing and the bar keeps its height. A person carries an email
 * only when their name is a display name, which makes the email the tooltip.
 * While the session read runs, the person is not known yet, so the header
 * draws the identity's placeholder.
 */
export type AccountIdentity =
  | {
      kind: "signed-in";
      person?: { name: string; initials: string; email?: string };
    }
  | { kind: "link"; label: string; to: string }
  | { kind: "waiting" }
  | { kind: "none" };

/**
 * The heading, or while the read that decides it runs, a bar of the heading's
 * line height, `bar` wide.
 */
export type AccountTitle = string | { bar: string };

/** A part that shows the wait's name, as a function of it. */
type Named = (name: ReactNode) => ReactNode;

/** What the panel draws around its body. */
type ShellFrame = {
  id: string;
  title: AccountTitle;
  identity: AccountIdentity;
  step?: SetupStep;
  /** The steps the reader has done, where that is not every earlier one. */
  complete?: readonly SetupStep[];
  below?: ReactNode;
};

/**
 * What the panel holds. While a read runs, `wait` is its operation, and the
 * heading, the body and the line below become one waiting region that names
 * it: in the line under the title or in the body, whichever is a function of
 * the name, or for screen readers only where neither is. A heading that waits
 * as a bar holds that hidden name, so screen readers hear one heading that
 * names the read.
 */
type ShellContent =
  | { wait?: string; detail?: ReactNode; children: ReactNode }
  | { wait: string; detail: Named; children: ReactNode }
  | { wait: string; detail?: ReactNode; children: Named };

/**
 * The one account composition: sign in, sign up, the magic link, the callback
 * and every onboarding step share this frame, so nothing moves as the user
 * walks the flow. One raised panel on a dotted canvas carries the wordmark, the
 * title, the form and — on the three setup steps — an attached progress strip.
 * The page around it holds only the identity and the two legal links, and the
 * header keeps one height whether the reader is signed in or not, so the panel
 * never shifts under them.
 */
export function AccountShell(props: ShellFrame & ShellContent) {
  const { id, title, identity, step, complete, below } = props;
  const signedIn = identity.kind === "signed-in" || identity.kind === "waiting";
  // A heading that the answer decides is the one place that names the read,
  // for screen readers only, so no other part of the panel holds the name.
  const headed = typeof title !== "string";
  const named =
    typeof props.detail === "function" || typeof props.children === "function";
  const panel = (name: ReactNode) => {
    const held = headed ? undefined : name;
    return (
      <>
        <div className="fo-account-heading">
          <AccountHeading title={title} name={headed ? name : undefined} />
          {typeof props.detail === "function" ? (
            // A name or a bar is no paragraph's content, so its line is a div.
            <div className="fo-account-detail">{props.detail(held)}</div>
          ) : (
            props.detail && <p className="fo-account-detail">{props.detail}</p>
          )}
        </div>
        <div className="fo-account-body">
          {typeof props.children === "function"
            ? props.children(held)
            : props.children}
        </div>
        {below}
      </>
    );
  };
  return (
    <div className="folio-root fo-account" data-mkc-screen={id}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="fo-account-header">
        {identity.kind === "signed-in" && <Account person={identity.person} />}
        {identity.kind === "waiting" && <AccountPlaceholder />}
        {identity.kind === "link" && (
          <MockLink to={identity.to}>{identity.label}</MockLink>
        )}
      </header>
      <main id="main" className="fo-account-main">
        <div className="fo-account-panel">
          <div className="fo-account-content">
            <div className="fo-account-mark">
              {signedIn ? <Brand /> : <SiteBrand />}
            </div>
            {props.wait === undefined ? (
              panel(undefined)
            ) : headed ? (
              <Pending label={props.wait} labelMode="screen-reader-only">
                {panel}
              </Pending>
            ) : named ? (
              <Pending label={props.wait}>{panel}</Pending>
            ) : (
              <Pending label={props.wait} labelMode="screen-reader-only">
                {panel(undefined)}
              </Pending>
            )}
          </div>
          {step && <SetupProgress step={step} complete={complete} />}
        </div>
      </main>
      <footer className="fo-account-footer">
        <a href={site.terms}>Terms</a>
        <a href={site.privacy}>Privacy</a>
      </footer>
    </div>
  );
}

/**
 * The panel's one heading. A heading that the answer decides keeps its frame
 * and holds a bar of its line height while it waits. The bar is hidden from
 * assistive technology like every placeholder, so the heading also holds
 * `name`, the read's name for screen readers only, and stays the screen's one
 * heading for them.
 */
function AccountHeading({
  title,
  name,
}: {
  title: AccountTitle;
  name?: ReactNode;
}) {
  return typeof title === "string" ? (
    <h1>{title}</h1>
  ) : (
    <h1>
      <TextBar width={title.bar} />
      {name}
    </h1>
  );
}
