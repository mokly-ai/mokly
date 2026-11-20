/**
 * The approved text of the four legal documents that the legal screens
 * draw: each document's source file, title, introduction and sections.
 */

import type { ReactNode } from "react";

/** One numbered section of a legal document. */
export interface LegalSection {
  readonly body: ReactNode;
  readonly title: string;
}

/** One legal document. */
export interface LegalDocument {
  /** The source path that labels the page frame. */
  readonly file: string;
  readonly introduction: string;
  readonly sections: readonly LegalSection[];
  readonly title: string;
}

/** The Terms of Service. */
export const TERMS: LegalDocument = {
  file: "legal/terms.md",
  introduction:
    "These Terms of Service govern your access to and use of Mokly Cloud.",
  sections: [
    {
      body: (
        <p>
          Mokly helps teams publish, browse, compare and share React-authored
          mockups connected to Git repositories and pull requests. Your
          repository remains the source of truth.
        </p>
      ),
      title: "1. What Mokly does",
    },
    {
      body: (
        <p>
          Keep your email account, GitHub account, sessions, invitations and
          publishing tokens secure, and review access when a team member changes
          role or leaves.
        </p>
      ),
      title: "2. Accounts and security",
    },
    {
      body: (
        <p>
          You keep ownership of the repositories, catalogues, screens and other
          content you submit. You give Mokly the rights needed to host and
          process that content to provide the service.
        </p>
      ),
      title: "3. Customer content",
    },
  ],
  title: "Terms of Service",
};

/** The Privacy Policy. */
export const PRIVACY: LegalDocument = {
  file: "legal/privacy.md",
  introduction: "This Privacy Policy explains how Mokly handles personal data.",
  sections: [
    {
      body: (
        <p>
          Calum Moore Consulting Limited is the controller for account
          administration, security, support and service operation. Customers
          normally control personal data included in their published content.
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
  ],
  title: "Privacy Policy",
};

/** The complaints process. */
export const COMPLAINTS: LegalDocument = {
  file: "legal/complaints.md",
  introduction: "This page explains how to make a complaint about Mokly.",
  sections: [
    {
      body: (
        <p>
          Email <a href="mailto:hello@mokly.ai">hello@mokly.ai</a> or write to
          Calum Moore Consulting Limited at its registered office.
        </p>
      ),
      title: "1. How to complain",
    },
    {
      body: (
        <p>
          Include your account email, the workspace or project, what happened,
          when it happened and the outcome you would like.
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
  ],
  title: "Complaints",
};

/** The security summary. */
export const SECURITY: LegalDocument = {
  file: "legal/security.md",
  introduction:
    "This page summarises how Mokly protects account, project, repository and publication data.",
  sections: [
    {
      body: (
        <p>
          Production runs in Google Cloud's us-central1 region with a private
          regional PostgreSQL database and private publication storage.
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
          short-lived host-only access cookie and never receive the app session.
        </p>
      ),
      title: "3. Publication isolation",
    },
  ],
  title: "Security",
};
