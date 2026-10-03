import { Badge } from "@firna/ui/badge";
import { Input } from "@firna/ui/input";

import {
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
      <MockLink fragment="details" to="example/screens/details">
        Open the details screen
      </MockLink>
      <toolbar.Component title="Workspace actions">
        <p>Explore the catalogue.</p>
      </toolbar.Component>
      <p>
        <MockLink to="example/getting-started" fragment="next-steps">
          Read the handbook
        </MockLink>
      </p>
      <p>
        <MockLink to="design/browse/views/home">
          See the Mokly shell design
        </MockLink>
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
      <MockLink to="example/screens/welcome">Return to welcome</MockLink>
      <toolbar.Component title="Catalogue actions">
        <p>Browse the connected screens.</p>
      </toolbar.Component>
    </main>
  );
}

export const welcome = defineScreen({
  ...metadata,

  address: "example.test/welcome",
  description: "A linked landing screen for the neutral fixture.",
  desktop: <Welcome compact={false} />,
  slug: "welcome",
  mobile: <Welcome compact />,
  tags: ["forms", "onboarding"],
  title: "Welcome",
  useCasePaths: ["example/tour"],
  variants: [
    {
      description: "The welcome screen before a workspace has a name.",
      desktop: <EmptyWorkspace compact={false} />,
      slug: "empty",
      mobile: <EmptyWorkspace compact />,
      title: "Welcome, empty workspace",
    },
  ],
});
export const details = defineScreen({
  ...metadata,

  address: "example.test/details",
  description: "A second synthetic screen proving cross-screen links.",
  desktop: <Details compact={false} />,
  slug: "details",
  mobile: <Details compact />,
  tags: ["forms"],
  title: "Details",
  useCasePaths: ["example/tour"],
});
export const handbook = definePage({
  ...metadata,

  slug: "getting-started",
  title: "Getting started",
  description: "A handbook to accompany the example screens.",
  tags: ["documents"],
  render: renderExampleDocument,
});
export const tour = defineUseCase({
  ...metadata,

  description: "An ordered journey that reuses both canonical screens.",
  slug: "tour",
  steps: [
    { screenPath: "example/screens/welcome" },
    { screenPath: "example/screens/details" },
  ],
  title: "Example tour",
});
