import type { ReactNode } from "react";

import { useDocumentTitle } from "../../layout/document-title";

import type { User } from "../../api/types";
import {
  AccountIdentity,
  AccountIdentityPlaceholder,
  Brand,
  SiteBrand,
} from "../../components/brand";
import { AppLink } from "../../components/app-link";
import { TextBar } from "../../components/placeholders";
import { site } from "../../config";
import { SetupProgress } from "./setup-progress";
import type { SetupStep } from "./setup-progress";

/**
 * Who the header names on the right: the signed-in person, one quiet link, or
 * nobody. Sign in and sign up carry their switch inside the panel, so their
 * header holds nothing and the bar keeps its height. While the session read
 * runs, the person is not known yet, so the header draws the identity's
 * placeholder.
 */
export type AccountIdentityKind =
  | { kind: "signed-in"; user: User }
  | { kind: "link"; label: string; href: string }
  | { kind: "waiting" }
  | { kind: "none" };

/**
 * The identity a signed-in screen's wait draws: the identity's placeholder
 * while the session read runs, the reader once it has answered.
 */
export type WaitingIdentity = Extract<
  AccountIdentityKind,
  { kind: "waiting" | "signed-in" }
>;

/** A part that shows the wait's name, as a function of it. */
type Named = (name: ReactNode) => ReactNode;

/**
 * The waiting region around the heading, the body and the line below, which
 * the screen draws as `Pending` around `panel`. `panel` lays the three out and
 * places the name in a heading that waits as a bar, or else in whichever of
 * the line under the title and the body is a function of it.
 */
export type ShellWait = (panel: (name: ReactNode) => ReactNode) => ReactNode;

/**
 * The heading: its words, or while the read that decides them runs, a bar of
 * the heading's line height, `bar` wide, beside the read's name for screen
 * readers, which the wait passes through its region. The tab still names the
 * page, so a heading that waits brings its own document title.
 */
type ShellTitle =
  | { title: string; documentTitle?: string }
  | { title: { bar: string }; documentTitle: string };

/**
 * What the panel holds. While a read runs, `wait` makes the heading, the body
 * and the line below one waiting region that names it: in the line under the
 * title or in the body, whichever is a function of the name, or for screen
 * readers only where neither is.
 */
type ShellContent =
  | { wait?: ShellWait; detail?: ReactNode; children: ReactNode }
  | { wait: ShellWait; detail: Named; children: ReactNode }
  | { wait: ShellWait; detail?: ReactNode; children: Named };

type ShellFrame = {
  screen: string;
  identity: AccountIdentityKind;
  step?: SetupStep;
  complete?: readonly SetupStep[];
  below?: ReactNode;
};

/**
 * The one account composition: sign in, sign up, the magic link and every
 * onboarding step share this frame, so nothing moves as the reader walks the
 * flow. One raised panel on a dotted canvas carries the wordmark, the title,
 * the body and — on the three setup steps — an attached progress strip.
 */
export function AccountShell(props: ShellFrame & ShellTitle & ShellContent) {
  const { screen, title, identity, step, complete, below } = props;
  useDocumentTitle(
    props.documentTitle ?? (typeof title === "string" ? title : undefined),
  );
  const signedIn = identity.kind === "signed-in" || identity.kind === "waiting";
  // A heading that the answer decides is the one place that names the read,
  // for screen readers only, so no other part of the panel holds the name.
  const headed = typeof title !== "string";
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
    <div className="folio-root fo-account" data-mkc-screen={screen}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="fo-account-header">
        {identity.kind === "signed-in" && (
          <AccountIdentity user={identity.user} />
        )}
        {identity.kind === "waiting" && <AccountIdentityPlaceholder />}
        {identity.kind === "link" && (
          <AppLink href={identity.href}>{identity.label}</AppLink>
        )}
      </header>
      <main id="main" className="fo-account-main">
        <div className="fo-account-panel">
          <div className="fo-account-content">
            <div className="fo-account-mark">
              {signedIn ? <Brand /> : <SiteBrand />}
            </div>
            {props.wait ? props.wait(panel) : panel(undefined)}
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
  title: string | { bar: string };
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
