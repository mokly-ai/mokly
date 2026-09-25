import { Badge } from "@firna/ui/badge";
import { Input } from "@firna/ui/input";

import {
  defineCollection,
  defineScreen,
  definePage,
  defineUseCase,
  MockLink,
  ReviewIgnore,
  reviewMaterialKey,
} from "@mokly/mokly";

import { action } from "../src/components/action/action.mokly.js";
import { toolbar } from "../src/components/toolbar/toolbar.mokly.js";
import { WorkspaceNote } from "../src/components/workspace-note/workspace-note.js";

import { renderExampleDocument } from "./document.js";

const metadata = {
  dependencies: ["examples/basic/generated/styles.css"],
  relatedDocs: ["examples/basic/notes.md"],
};

/**
 * Firna needs handlers to render enabled controls without warnings. The
 * generated MockLink anchors navigate natively; these callbacks never run.
 */
const noop = (): void => undefined;

function Welcome({ compact }: { compact: boolean }) {
  return (
    <main id="welcome" className="example-screen">
      <ReviewIgnore
        id="example-nav"
        materialKey={reviewMaterialKey({ compact })}
      >
        <nav>{compact ? "Menu" : "Example navigation"}</nav>
      </ReviewIgnore>
      <header className="example-head">
        <h1>Welcome to Mokly</h1>
        <Badge tone="primary">Example</Badge>
      </header>
      <Input
        aria-label="Workspace name"
        onChangeText={noop}
        placeholder="Name this workspace"
        value=""
      />
      <WorkspaceNote />
      <action.Component
        moklyInstance="details"
        label="View details"
        tone="primary"
        destination="details"
      />
      <MockLink fragment="details" to="example-details">
        Open the details screen
      </MockLink>
      <toolbar.Component title="Workspace actions">
        <p>Explore the catalogue.</p>
      </toolbar.Component>
      <p>
        <MockLink to="example-handbook" fragment="next-steps">
          Read the handbook
        </MockLink>
      </p>
      <p>
        <MockLink to="design-browse-home">See the Mokly shell design</MockLink>
      </p>
    </main>
  );
}

function EmptyWorkspace({ compact }: { compact: boolean }) {
  return (
    <main id="welcome-empty" className="example-screen">
      <ReviewIgnore
        id="example-nav"
        materialKey={reviewMaterialKey({ compact })}
      >
        <nav>{compact ? "Menu" : "Example navigation"}</nav>
      </ReviewIgnore>
      <header className="example-head">
        <h1>Create your first workspace</h1>
        <Badge tone="primary">Welcome</Badge>
      </header>
      <Input
        aria-label="Workspace name"
        onChangeText={noop}
        placeholder="Name this workspace"
        value=""
      />
      <action.Component
        disabled
        label="Create workspace"
        moklyInstance="create-workspace"
        tone="primary"
      />
      <p>Enter a workspace name to continue.</p>
    </main>
  );
}

function Details({ compact }: { compact: boolean }) {
  return (
    <main id="details" className="example-screen">
      <header className="example-head">
        <h1>{compact ? "Details" : "Example catalogue details"}</h1>
        <Badge tone="neutral">Synthetic</Badge>
      </header>
      <p>This screen is synthetic and belongs only to the package example.</p>
      <action.Component
        moklyInstance="welcome"
        label="Return to welcome"
        tone="secondary"
        destination="welcome"
      />
      <MockLink to="example-welcome">Return to welcome</MockLink>
      <toolbar.Component title="Catalogue actions">
        <p>Browse the connected screens.</p>
      </toolbar.Component>
    </main>
  );
}

export const mockups = [
  defineCollection({
    ...metadata,
    id: "example-components",
    title: "Components",
    description: "Shared actions and composition.",
    childIds: ["example-action", "example-toolbar"],
  }),
  defineCollection({
    ...metadata,
    childIds: [
      "example-screens",
      "example-tour",
      "example-components",
      "example-handbook",
    ],
    description: "Synthetic examples for the reusable Mokly package.",
    id: "example",
    title: "Example",
  }),
  defineCollection({
    ...metadata,
    childIds: ["example-welcome", "example-details"],
    description: "Synthetic screens used to exercise the reusable framework.",
    id: "example-screens",
    title: "Screens",
  }),
  defineScreen({
    ...metadata,
    address: "example.test/welcome",
    description: "A linked landing screen for the neutral fixture.",
    desktop: <Welcome compact={false} />,
    id: "example-welcome",
    mobile: <Welcome compact />,
    route: "screens/welcome.html",
    tags: ["forms", "onboarding"],
    title: "Welcome",
    useCaseIds: ["example-tour"],
    variants: [
      {
        description: "The welcome screen before a workspace has a name.",
        desktop: <EmptyWorkspace compact={false} />,
        id: "example-welcome-empty",
        mobile: <EmptyWorkspace compact />,
        slug: "empty",
        title: "Welcome, empty workspace",
      },
    ],
  }),
  defineScreen({
    ...metadata,
    address: "example.test/details",
    description: "A second synthetic screen proving cross-screen links.",
    desktop: <Details compact={false} />,
    id: "example-details",
    mobile: <Details compact />,
    route: "screens/details.html",
    tags: ["forms"],
    title: "Details",
    useCaseIds: ["example-tour"],
  }),
  definePage({
    ...metadata,
    id: "example-handbook",
    title: "Getting started",
    description: "A handbook to accompany the example screens.",
    route: "handbook.html",
    tags: ["documents"],
    render: renderExampleDocument,
  }),
  defineUseCase({
    ...metadata,
    description: "An ordered journey that reuses both canonical screens.",
    id: "example-tour",
    route: "user-flows/example-tour.html",
    steps: [{ screenId: "example-welcome" }, { screenId: "example-details" }],
    title: "Example tour",
  }),
];
