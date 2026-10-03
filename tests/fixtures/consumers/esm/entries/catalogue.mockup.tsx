import React from "react";

import {
  definePage,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
} from "@mokly/mokly";

const metadata = {
  relatedDocs: ["notes.md"],
};

export const mockups = [
  definePage({
    ...metadata,
    navPath: ["Packed ESM"],
    id: "packed-handbook",
    title: "Handbook",
    description: "Whole document in the packed API",
    render: () =>
      '<html><body><main id="handbook">Handbook</main><a href="mock:packed-home">Home</a></body></html>',
  }),
  defineScreen({
    ...metadata,
    navPath: ["Packed ESM", "Packed pages"],
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
    title: "Packed home",
    useCaseIds: ["packed-tour"],
    variants: [
      {
        description: "Packed home without content.",
        desktop: <main data-fixture="esm-empty-desktop">Empty</main>,
        id: "packed-home-empty",
        mobile: <main data-fixture="esm-empty-mobile">Empty</main>,
        title: "Packed home, empty",
      },
    ],
  }),
  defineScreen({
    ...metadata,
    navPath: ["Packed ESM", "Packed pages"],
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
    title: "Packed details",
    useCaseIds: ["packed-tour"],
  }),
  defineUseCase({
    ...metadata,
    navPath: ["Packed ESM"],
    description: "A two-step packed package journey.",
    id: "packed-tour",
    steps: [{ screenId: "packed-home" }, { screenId: "packed-detail" }],
    title: "Packed tour",
  }),
];
