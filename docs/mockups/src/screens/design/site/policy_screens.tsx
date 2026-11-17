/** The four legal documents in the site's shared readable document layout. */

import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { SiteLayout } from "./parts/chrome.js";
import {
  SITE_LEGAL_SCREENS,
  SITE_SCREENS,
  type SiteScreen,
} from "./parts/links.js";

interface PolicySection {
  readonly body: ReactNode;
  readonly title: string;
}

function PolicyScreen({
  active,
  introduction,
  sections,
  title,
  viewport,
}: {
  active: SiteScreen;
  introduction: string;
  sections: readonly PolicySection[];
  title: string;
  viewport: "mobile" | "desktop";
}) {
  return (
    <SiteLayout active={active} viewport={viewport}>
      <main className="site-document site-policy" id="main">
        <div className="site-document-intro">
          <p className="site-eyebrow">Legal</p>
          <h1>{title}</h1>
          <p className="site-policy-date">
            Effective <time dateTime="2026-09-22">22 September 2026</time>
          </p>
        </div>
        <div className="site-document-body site-policy-body">
          <p>{introduction}</p>
          {sections.map((section) => (
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
      </main>
    </SiteLayout>
  );
}

function Terms({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.terms}
      introduction="These Terms of Service govern your access to and use of Mokly Cloud."
      sections={[
        {
          body: (
            <p>
              Mokly helps teams publish, browse, compare and share
              React-authored mockups connected to Git repositories and pull
              requests. Your repository remains the source of truth.
            </p>
          ),
          title: "1. What Mokly does",
        },
        {
          body: (
            <p>
              Keep your email account, GitHub account, sessions, invitations and
              publishing tokens secure, and review access when a team member
              changes role or leaves.
            </p>
          ),
          title: "2. Accounts and security",
        },
        {
          body: (
            <p>
              You keep ownership of the repositories, catalogues, screens and
              other content you submit. You give Mokly the rights needed to host
              and process that content to provide the service.
            </p>
          ),
          title: "3. Customer content",
        },
      ]}
      title="Terms of Service"
      viewport={viewport}
    />
  );
}

function Privacy({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.privacy}
      introduction="This Privacy Policy explains how Mokly handles personal data."
      sections={[
        {
          body: (
            <p>
              Calum Moore Consulting Limited is the controller for account
              administration, security, support and service operation. Customers
              normally control personal data included in their published
              content.
            </p>
          ),
          title: "1. Controller and service role",
        },
        {
          body: (
            <p>
              Mokly processes account, workspace, project, GitHub, publication,
              support and technical data where needed to provide and protect the
              service.
            </p>
          ),
          title: "2. Data we collect",
        },
        {
          body: (
            <p>
              Production application records and publication files are hosted in
              Google Cloud's us-central1 region in the United States.
            </p>
          ),
          title: "3. Hosting and transfers",
        },
      ]}
      title="Privacy Policy"
      viewport={viewport}
    />
  );
}

function Complaints({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.complaints}
      introduction="This page explains how to make a complaint about Mokly."
      sections={[
        {
          body: (
            <p>
              Email <a href="mailto:hello@mokly.ai">hello@mokly.ai</a> or write
              to Calum Moore Consulting Limited at its registered office.
            </p>
          ),
          title: "1. How to complain",
        },
        {
          body: (
            <p>
              Include your account email, the workspace or project, what
              happened, when it happened and the outcome you would like.
            </p>
          ),
          title: "2. What to include",
        },
        {
          body: (
            <p>
              Mokly will investigate fairly and explain the outcome. A data
              protection complaint is acknowledged within 30 days.
            </p>
          ),
          title: "3. What happens next",
        },
      ]}
      title="Complaints"
      viewport={viewport}
    />
  );
}

function Security({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <PolicyScreen
      active={SITE_SCREENS.security}
      introduction="This page summarises how Mokly protects account, project, repository and publication data."
      sections={[
        {
          body: (
            <p>
              Production runs in Google Cloud's us-central1 region with a
              private regional PostgreSQL database and private publication
              storage.
            </p>
          ),
          title: "1. Hosting and isolation",
        },
        {
          body: (
            <p>
              One-use magic links and GitHub OAuth create revocable, server-side
              sessions. Mokly stores token digests instead of the credentials
              themselves.
            </p>
          ),
          title: "2. Authentication and sessions",
        },
        {
          body: (
            <p>
              Each publication has its own origin. Private publications use a
              short-lived host-only access cookie and never receive the app
              session.
            </p>
          ),
          title: "3. Publication isolation",
        },
      ]}
      title="Security"
      viewport={viewport}
    />
  );
}

/** The Terms screen, with its composition selected by the viewport. */
export function SiteTermsScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <Terms viewport={viewport} />;
}

/** The Privacy screen, with its composition selected by the viewport. */
export function SitePrivacyScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <Privacy viewport={viewport} />;
}

/** The Complaints screen, with its composition selected by the viewport. */
export function SiteComplaintsScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <Complaints viewport={viewport} />;
}

/** The Security screen, with its composition selected by the viewport. */
export function SiteSecurityScreen({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return <Security viewport={viewport} />;
}
