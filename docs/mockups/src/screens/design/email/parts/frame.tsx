/**
 * The catalogue frame around one delivered message: the subject and the line
 * an inbox list shows beneath it, then the message itself. The message is
 * drawn in the scheme and viewport of the generated document, so the dark and
 * mobile artboards are what a client honoring those queries shows rather than
 * a light desktop document asked to stand in for them. The logo resolves
 * against the catalogue's own resource path, as it resolves against the site
 * origin in a delivered message.
 */

import { EmailBody } from "../../../../emails/document";
import type { EmailDefinition } from "../../../../emails/document";
import { useMockupRenderContext } from "../../../../render-context";
import { useRepositoryFile } from "../../../../resource-root";

import { EMAIL_BRAND_ROOT } from "./metadata";

/** One email screen: inbox lines above, the delivered message below. */
export function EmailFrame<Content>({
  content,
  email,
  id,
}: {
  content: Content;
  email: EmailDefinition<Content>;
  id: string;
}) {
  const { colorScheme, viewport } = useMockupRenderContext();
  const brandRoot = useRepositoryFile("docs/mockups/" + EMAIL_BRAND_ROOT);
  return (
    <div
      className="email-screen"
      data-email-viewport={viewport}
      data-mkc-screen={id}
    >
      <main className="email-stage" id="main">
        <div className="email-inbox">
          <p className="email-subject">{email.subject(content)}</p>
          <p className="email-preheader">{email.preheader(content)}</p>
        </div>
        <div className="email-message">
          <EmailBody
            brandRoot={brandRoot}
            colorScheme={colorScheme}
            content={content}
            email={email}
            viewport={viewport}
          />
        </div>
      </main>
    </div>
  );
}
