/**
 * The two delivered messages that the Design Email screens draw, each
 * rendered as the shared body for one scheme and viewport, with the brand
 * root that the generated email documents use. The email tests share them.
 */

import { dirname, relative } from "node:path";

import type {
  TokenColorScheme,
  TokenViewport,
} from "@mokly-cloud/tokens/tokens";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EmailBody } from "../emails/document";
import type { EmailDefinition } from "../emails/document";
import { invitationEmail } from "../emails/invitation";
import { signInEmail } from "../emails/sign-in";
import { invitationContent, signInContent } from "../fixtures/emails";
import { EMAIL_BRAND_ROOT } from "../screens/design/email/parts/metadata";
import { repositoryFilePath, screenView } from "./catalogue-paths";
import { authoredPath } from "./catalogue-reads";

export const schemes = ["light", "dark"] as const;
export const viewports = ["mobile", "desktop"] as const;

/** Resolve the brand from the nested generated email document. */
export const brandRoot =
  relative(
    dirname(screenView("design/email/sign-in", "desktop")),
    repositoryFilePath(authoredPath(EMAIL_BRAND_ROOT)),
  ) + "/";

function subtree<Content>(
  email: EmailDefinition<Content>,
  content: Content,
  colorScheme: TokenColorScheme,
  viewport: TokenViewport,
): string {
  return renderToStaticMarkup(
    createElement(EmailBody<Content>, {
      brandRoot,
      colorScheme,
      content,
      email,
      viewport,
    }),
  );
}

export const messages = [
  {
    id: "design/email/sign-in",
    preheader: signInEmail.preheader(signInContent),
    subject: signInEmail.subject(signInContent),
    subtree: (scheme: TokenColorScheme, viewport: TokenViewport) =>
      subtree(signInEmail, signInContent, scheme, viewport),
  },
  {
    id: "design/email/invitation",
    preheader: invitationEmail.preheader(invitationContent),
    subject: invitationEmail.subject(invitationContent),
    subtree: (scheme: TokenColorScheme, viewport: TokenViewport) =>
      subtree(invitationEmail, invitationContent, scheme, viewport),
  },
];
