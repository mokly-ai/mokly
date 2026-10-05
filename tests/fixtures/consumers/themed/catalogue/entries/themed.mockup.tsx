import { FirnaButton, FirnaCard } from "@firna/ui";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  definePage,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
} from "@mokly/mokly";

import { accent } from "../../shared/tokens.js";
import { renderComponent } from "../legacy/components.js";

const common = {
  dependencies: ["packages/firna-ui/index.tsx", "shared/tokens.ts"],
  relatedDocs: ["docs/catalogue.md"],
};

function Dashboard({ compact }: { compact: boolean }) {
  return (
    <FirnaCard accent={accent} compact={compact}>
      <ReviewIgnore id="consumer-navigation">
        <nav>Application navigation</nav>
      </ReviewIgnore>
      <h1>Workspace overview</h1>
      <MockLink to="themed-campaign">View campaign</MockLink>
      <MockLink asChild to="themed-campaign">
        <FirnaButton>Open campaign</FirnaButton>
      </MockLink>
    </FirnaCard>
  );
}

export const mockups = [
  definePage({
    ...common,

    path: "themed-notice",
    title: "Notice",
    description: "A complete consumer-composed document.",
    render: () =>
      "<!doctype html>" +
      renderToStaticMarkup(
        <html lang="en">
          <body>
            {renderComponent("notice", { label: "Expanded legacy notice" })}
          </body>
        </html>,
      ),
  }),
  defineScreen({
    slug: "themed-dashboard",
    ...common,

    description: "A synthetic application dashboard.",
    desktop: <Dashboard compact={false} />,
    path: "themed-dashboard",
    mobile: <Dashboard compact />,
    title: "Workspace overview",
    useCasePaths: ["themed-tour"],
  }),
  defineScreen({
    slug: "themed-campaign",
    ...common,

    description: "A synthetic marketing route with separate styling.",
    desktop: <main data-campaign="desktop">Campaign desktop</main>,
    path: "themed-campaign",
    mobile: <main data-campaign="mobile">Campaign mobile</main>,
    title: "Campaign",
    useCasePaths: ["themed-tour"],
  }),
  defineUseCase({
    ...common,

    description: "A synthetic cross-style journey.",
    path: "themed-tour",
    steps: [
      { screenPath: "themed-dashboard" },
      { screenPath: "themed-campaign" },
    ],
    title: "Themed tour",
  }),
];
