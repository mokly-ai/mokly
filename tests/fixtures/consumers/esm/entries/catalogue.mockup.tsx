import React from "react";

import {
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

    path: "packed-handbook",
    title: "Handbook",
    description: "Whole document in the packed API",
    render: () =>
      '<html><body><main id="handbook">Handbook</main><a href="mock:packed-home">Home</a></body></html>',
  }),
  ...defineScreen({
    slug: "packed-home",
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
    path: "packed-home",
    mobile: (
      <main data-fixture="esm-mobile">
        <MockLink fragment="packed-section" to="packed-detail">
          Open details
        </MockLink>
      </main>
    ),
    title: "Packed home",
    useCasePaths: ["packed-tour"],
    variants: [
      {
        slug: "empty",
        description: "Packed home without content.",
        desktop: <main data-fixture="esm-empty-desktop">Empty</main>,

        mobile: <main data-fixture="esm-empty-mobile">Empty</main>,
        title: "Packed home, empty",
      },
    ],
  }),
  defineScreen({
    slug: "packed-detail",
    ...metadata,

    description: "The destination in the clean ESM consumer.",
    desktop: (
      <main data-fixture="esm-detail-desktop" id="packed-section">
        Packed details
      </main>
    ),
    path: "packed-detail",
    mobile: (
      <main data-fixture="esm-detail-mobile" id="packed-section">
        Packed details
      </main>
    ),
    title: "Packed details",
    useCasePaths: ["packed-tour"],
  }),
  defineUseCase({
    ...metadata,

    description: "A two-step packed package journey.",
    path: "packed-tour",
    steps: [{ screenPath: "packed-home" }, { screenPath: "packed-detail" }],
    title: "Packed tour",
  }),
];
