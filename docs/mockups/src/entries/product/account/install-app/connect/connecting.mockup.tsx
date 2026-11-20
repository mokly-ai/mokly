import { defineScreen } from "@mokly/mokly";

import { ConnectConnectingScreen } from "../../../../../screens/product/account/connect-screen";

export default defineScreen({
  title: "Connect a GitHub account · Connecting",
  description:
    "Continue on GitHub while its write runs: the Workspace select keeps the chosen workspace, the control keeps its place and reads Connecting… with the busy spinner until the page leaves for GitHub, and screen readers hear Connecting a GitHub account. The form inserts nothing. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups-account.md",
    "docs/protocol/cloud/folio-chrome.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "account", "loading"],
  render: (_props, { viewport }) => (
    <ConnectConnectingScreen viewport={viewport} />
  ),
});
