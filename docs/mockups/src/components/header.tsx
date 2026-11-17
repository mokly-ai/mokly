import { MockLink } from "@mokly/mokly";

import { Button } from "../entries/design/button.mockup";
import { site } from "../fixtures/site";
import { componentInput, componentMetadata } from "./metadata";

export const headerInput = componentInput({
  ...componentMetadata(
    "Header",
    "Brand, primary navigation, and account entry.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["compact"],
    properties: { compact: { type: "boolean" } },
  },
  props: { compact: false },
  slots: ["navigation", "actions"],
  controls: { compact: { kind: "boolean" } },
  render: ({ compact, navigation, actions }) => (
    <header className={"site-header" + (compact ? " header-compact" : "")}>
      <a href={site.home} className="brand" aria-label="Mokly home">
        <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <rect
            x="3"
            y="3"
            width="20"
            height="21"
            rx="4"
            fill="currentColor"
            opacity=".3"
          />
          <rect x="9" y="8" width="20" height="21" rx="4" fill="currentColor" />
          <path
            d="M14 15h10M14 20h7"
            stroke="var(--mk-color-surface)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Mokly</span>
      </a>
      <nav aria-label="Main">{navigation}</nav>
      <div className="header-actions">{actions}</div>
    </header>
  ),
  variants: [
    {
      slug: "full",
      title: "Full",
      props: { compact: false },
      slots: {
        navigation: (
          <>
            <a href={site.docs}>Docs</a>
            <a href={site.changelog}>Changelog</a>
          </>
        ),
        actions: (
          <>
            <MockLink className="navigation-link" to="product/account/sign-in">
              Sign in
            </MockLink>
            <MockLink asChild to="product/account/sign-up">
              <Button label="Get started" tone="primary" />
            </MockLink>
          </>
        ),
      },
    },
    {
      slug: "compact",
      title: "Compact",
      props: { compact: true },
      slots: {
        navigation: <a href={site.docs}>Docs</a>,
        actions: (
          <MockLink className="navigation-link" to="product/account/sign-in">
            Sign in
          </MockLink>
        ),
      },
    },
  ],
});
