import { defineScreen } from "@mokly/mokly";

import { TokensScreen } from "../../screens/design/tokens-screen";

export default defineScreen({
  title: "Design tokens",
  description: "The canonical theme, type, and spacing values.",
  relatedDocs: [
    "docs/protocol/cloud/design-tokens.md",
    "docs/protocol/cloud/design-tokens-color.md",
  ],
  render: () => <TokensScreen />,
});
