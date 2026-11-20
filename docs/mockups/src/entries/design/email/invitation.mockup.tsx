import { defineScreen } from "@mokly/mokly";

import { EmailInvitationScreen } from "../../../screens/design/email/invitation_screen";
import {
  EMAIL_RELATED_DOCS,
  EMAIL_TAGS,
} from "../../../screens/design/email/parts/metadata";

export default defineScreen({
  description:
    "Who invited the reader, to which workspace, and the link that accepts it.",
  relatedDocs: [...EMAIL_RELATED_DOCS, "docs/protocol/cloud/platform-model.md"],
  render: () => <EmailInvitationScreen />,
  tags: EMAIL_TAGS,
  title: "Invitation email",
  useCasePaths: ["flows/product-invitation"],
});
