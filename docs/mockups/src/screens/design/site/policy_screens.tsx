/**
 * The four legal documents. Each is a page frame on the canvas, labelled
 * with its source file, holding the Legal kicker, the title, the effective
 * date, the ruled body and the links to the other legal documents.
 */

import { MockLink } from "@mokly/mokly";

import { SiteLayout } from "./parts/chrome.js";
import { SiteKicker } from "./parts/labels.js";
import {
  COMPLAINTS,
  PRIVACY,
  SECURITY,
  TERMS,
  type LegalDocument,
} from "./parts/legal-documents.js";
import {
  SITE_LEGAL_SCREENS,
  SITE_SCREENS,
  type SiteScreen,
} from "./parts/links.js";
import { SitePageFrame } from "./parts/page-frame.js";

function PolicyScreen({
  active,
  document,
  viewport,
}: {
  active: SiteScreen;
  document: LegalDocument;
  viewport: "mobile" | "desktop";
}) {
  return (
    <SiteLayout active={active} viewport={viewport}>
      <main className="site-policy" id="main">
        <SitePageFrame file={document.file}>
          <div className="site-document-intro">
            <SiteKicker>Legal</SiteKicker>
            <h1>{document.title}</h1>
            <p className="site-policy-date">
              Effective <time dateTime="2026-11-22">22 November 2026</time>
            </p>
          </div>
          <div className="site-document-body site-policy-body">
            <p>{document.introduction}</p>
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.body}
              </section>
            ))}
          </div>
          <nav aria-label="Legal documents" className="site-policy-links">
            <p className="site-policy-links-title">Legal documents</p>
            <div className="site-policy-link-list">
              {SITE_LEGAL_SCREENS.filter(([screen]) => screen !== active).map(
                ([screen, label]) => (
                  <MockLink className="site-link" key={screen} to={screen}>
                    {label} <span aria-hidden="true">&#8594;</span>
                  </MockLink>
                ),
              )}
            </div>
          </nav>
        </SitePageFrame>
      </main>
    </SiteLayout>
  );
}

/** The Terms screen, with its composition selected by the viewport. */
export function SiteTermsScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.terms}
      document={TERMS}
      viewport={viewport}
    />
  );
}

/** The Privacy screen, with its composition selected by the viewport. */
export function SitePrivacyScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.privacy}
      document={PRIVACY}
      viewport={viewport}
    />
  );
}

/** The Complaints screen, with its composition selected by the viewport. */
export function SiteComplaintsScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.complaints}
      document={COMPLAINTS}
      viewport={viewport}
    />
  );
}

/** The Security screen, with its composition selected by the viewport. */
export function SiteSecurityScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.security}
      document={SECURITY}
      viewport={viewport}
    />
  );
}
