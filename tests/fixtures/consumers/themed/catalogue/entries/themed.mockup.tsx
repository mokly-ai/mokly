import { FirnaButton, FirnaCard } from "@firna/ui";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  definePage,
  defineCollection,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
} from "@mokly/mokly";

import { accent } from "../../shared/tokens.js";
import { renderComponent } from "../legacy/components.js";

const common = {
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
    id: "themed-notice",
    title: "Notice",
    description: "A complete consumer-composed document.",
    route: "archive/legacy-notice.html",
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
  defineCollection({
    ...common,
    childIds: ["themed-tour"],
    description: "Synthetic themed-consumer user flows.",
    id: "themed-flows",
    title: "Flows",
  }),
  defineCollection({
    ...common,
    childIds: ["themed-dashboard", "themed-campaign", "themed-notice"],
    description: "A themed nested catalogue.",
    id: "themed-fixture",
    title: "Themed fixture",
  }),
  defineScreen({
    ...common,
    description: "A synthetic application dashboard.",
    desktop: <Dashboard compact={false} />,
    id: "themed-dashboard",
    mobile: <Dashboard compact />,
    route: "app/dashboard.html",
    title: "Workspace overview",
    useCaseIds: ["themed-tour"],
  }),
  defineScreen({
    ...common,
    description: "A synthetic marketing route with separate styling.",
    desktop: <main data-campaign="desktop">Campaign desktop</main>,
    id: "themed-campaign",
    mobile: <main data-campaign="mobile">Campaign mobile</main>,
    route: "marketing/campaign.html",
    title: "Campaign",
    useCaseIds: ["themed-tour"],
  }),
  defineUseCase({
    ...common,
    description: "A synthetic cross-style journey.",
    id: "themed-tour",
    route: "user-flows/themed-tour.html",
    steps: [{ screenId: "themed-dashboard" }, { screenId: "themed-campaign" }],
    title: "Themed tour",
  }),
];
