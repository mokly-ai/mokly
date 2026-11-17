import { defineScreen } from "@mokly/mokly";

import {
  EMAIL_RELATED_DOCS,
  EMAIL_TAGS,
} from "../../../screens/design/email/parts/metadata";
import { EmailSignInScreen } from "../../../screens/design/email/sign_in_screen";

export default defineScreen({
  description:
    "The link that signs the reader in, with the one sentence about how long it lasts.",
  relatedDocs: [...EMAIL_RELATED_DOCS, "docs/protocol/cloud/auth-sessions.md"],
  render: () => <EmailSignInScreen />,
  tags: EMAIL_TAGS,
  title: "Sign-in email",
  useCasePaths: ["flows/product-onboarding"],
});
