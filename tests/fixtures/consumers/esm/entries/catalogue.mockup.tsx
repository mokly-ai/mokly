import React from "react";

import {
  defineCollection,
  definePage,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
} from "@mokly/mokly";

const metadata = {
  dependencies: ["notes.md"],
  relatedDocs: ["notes.md"],
};

export const mockups = [
  definePage({
    ...metadata,
    id: "packed-handbook",
    title: "Handbook",
    description: "Whole document in the packed API",
    route: "handbook.html",
    render: () =>
      '<html><body><main id="handbook">Handbook</main><a href="mock:packed-home">Home</a></body></html>',
  }),
  defineCollection({
    ...metadata,
    childIds: ["packed-pages", "packed-tour", "packed-handbook"],
    description: "Packed ESM consumer catalogue.",
    id: "packed-esm",
    title: "Packed ESM",
  }),
  defineCollection({
    ...metadata,
    childIds: ["packed-home", "packed-detail", "packed-card"],
    description: "Screens loaded from an installed tarball.",
    id: "packed-pages",
    title: "Packed pages",
  }),
  defineScreen({
    ...metadata,
    description: "A clean ESM consumer screen.",
    desktop: (
      <main data-fixture="esm-desktop">
        <ReviewIgnore id="fixture-navigation">
          <nav>Fixture navigation</nav>
        </ReviewIgnore>
        <MockLink fragment="packed-section" to="packed-detail">
          Open details
        </MockLink>
      </main>
    ),
    id: "packed-home",
    mobile: (
      <main data-fixture="esm-mobile">
        <MockLink fragment="packed-section" to="packed-detail">
          Open details
        </MockLink>
      </main>
    ),
    route: "screens/home.html",
    title: "Packed home",
    useCaseIds: ["packed-tour"],
    variants: [
      {
        description: "Packed home without content.",
        desktop: <main data-fixture="esm-empty-desktop">Empty</main>,
        id: "packed-home-empty",
        mobile: <main data-fixture="esm-empty-mobile">Empty</main>,
        slug: "empty",
        title: "Packed home, empty",
      },
    ],
  }),
  defineScreen({
    ...metadata,
    description: "The destination in the clean ESM consumer.",
    desktop: (
      <main data-fixture="esm-detail-desktop" id="packed-section">
        Packed details
      </main>
    ),
    id: "packed-detail",
    mobile: (
      <main data-fixture="esm-detail-mobile" id="packed-section">
        Packed details
      </main>
    ),
    route: "screens/detail.html",
    title: "Packed details",
    useCaseIds: ["packed-tour"],
  }),
  defineUseCase({
    ...metadata,
    description: "A two-step packed package journey.",
    id: "packed-tour",
    route: "user-flows/packed-tour.html",
    steps: [{ screenId: "packed-home" }, { screenId: "packed-detail" }],
    title: "Packed tour",
  }),
];
