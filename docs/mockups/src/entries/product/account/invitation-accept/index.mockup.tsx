import { defineScreen } from "@mokly/mokly";

import {
  InvitationAcceptScreen,
  InvitationAcceptEmptyScreen,
  InvitationAcceptLoadingScreen,
  InvitationAcceptErrorScreen,
} from "../../../../screens/product/account/invitation-accept-screen";

/** The named screen component that each state draws. */
const screens = {
  default: InvitationAcceptScreen,
  empty: InvitationAcceptEmptyScreen,
  loading: InvitationAcceptLoadingScreen,
  error: InvitationAcceptErrorScreen,
};

export default defineScreen({
  title: "Accept invitation",
  description: "The invited reader signs in and joins the workspace.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio", "account", "default"],
  useCasePaths: ["flows/product-invitation"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Accept invitation · Empty",
      description: "This account cannot use the invitation.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Accept invitation · Loading",
      description: "The invitation is accepted while the workspace loads.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Accept invitation · Error",
      description: "A temporary failure can be retried.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
