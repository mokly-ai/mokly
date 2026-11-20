/**
 * The Your first screen guide, word for word from the workspace package's
 * `docs/guides/start/your-first-screen.md`. Its first code block,
 * `specs/welcome.screen.html`, renders as the HTML sample fence.
 */

import { CodePanel, type CodeLine } from "./code_panel.js";
import {
  ACCOUNT_HOME_SCREEN,
  BUILD_OUT,
  SERVE,
  VALIDATE,
} from "./docs-first-screen-code.js";
import type { DocsPage } from "./docs-pages.js";
import { DocsSample } from "./docs-sample.js";

/** Shell commands under their fence language, each with its prompt. */
function Shell({
  language,
  lines,
}: {
  language: string;
  lines: readonly CodeLine[];
}) {
  return <CodePanel language={language} lines={lines} prompt />;
}

/** The Your first screen page, the third guide of Getting started. */
export const FIRST_SCREEN_PAGE: DocsPage = {
  description: "Author one screen with a mobile view and a desktop view.",
  file: "start/your-first-screen.md",
  next: {
    description: "Write a complete static catalogue that you can deploy.",
    section: "Getting started",
    title: "Build",
  },
  previous: {
    description: "Tell Mokly which authored files belong to the catalogue.",
    section: "Getting started",
    title: "Configure",
  },
  section: "Getting started",
  sections: [
    {
      body: (
        <>
          <p>
            Create <code>specs/welcome.screen.html</code>. Its file name gives
            it the catalogue path <code>welcome</code>.
          </p>
          <DocsSample />
          <p>
            The YAML block supplies the title, data, and one saved state. The
            HTML body renders at mobile and desktop. Substituted values are
            escaped. The variant uses the same body with its own prop overrides.
          </p>
        </>
      ),
      id: "add-one-html-file",
      title: "Add one HTML file",
    },
    {
      body: (
        <>
          <Shell language="bash" lines={[VALIDATE]} />
          <p>
            The build renders every view and checks links and resources. Strict
            mode also fails on warnings. It writes the static catalogue to{" "}
            <code>mokly-static</code> by default. Keep that directory ignored by
            Git.
          </p>
        </>
      ),
      id: "validate-the-catalogue",
      title: "Validate the catalogue",
    },
    {
      body: (
        <>
          <Shell language="bash" lines={[SERVE]} />
          <p>
            Open the listening URL printed in the terminal. Select Welcome in
            the tree. Switch between its viewports and its First visit variant.
            Save an edit to the HTML file to refresh the visible view.
          </p>
          <p>
            Read Screens for metadata and body rules. Read Components to reuse
            shared markup.
          </p>
        </>
      ),
      id: "open-the-catalogue",
      title: "Open the catalogue",
    },
    {
      body: (
        <>
          <p>
            Put a <code>.mockup.tsx</code> file inside a configured root. With
            the default <code>specs</code> root, use{" "}
            <code>specs/account/account-home.mockup.tsx</code>:
          </p>
          <CodePanel
            files={["account-home.mockup.tsx"]}
            language="tsx"
            lines={ACCOUNT_HOME_SCREEN}
            meta="specs/account"
            numbered
          />
          <p>
            Export one definition per export. A named export and a default
            export both register. Arrays are not definitions. Helper functions
            and ordinary React components can share the module.
          </p>
        </>
      ),
      id: "start-with-a-react-screen",
      title: "Start with a React screen",
    },
    {
      body: (
        <p>
          The render returns React content. It receives <code>props</code> and a
          context with <code>viewport</code> and <code>colorScheme</code>.
          Import your product&apos;s components and use them in that render. Put
          product providers in your configured renderer.
        </p>
      ),
      id: "use-your-product-components",
      title: "Use your product components",
    },
    {
      body: (
        <p>
          The screen has path <code>account/account-home</code> and catalogue
          URL <code>/view/account/account-home/</code>. Directories below the
          root supply its folders. The file name up to its first dot supplies
          its last segment. Set <code>slug</code> to replace that segment. Set{" "}
          <code>path</code> to declare a complete path. A file named{" "}
          <code>index.mockup.tsx</code> supplies its folder&apos;s own page.
        </p>
      ),
      id: "find-the-screen",
      title: "Find the screen",
    },
    {
      body: (
        <>
          <p>
            Serve reads authored sources and keeps rendered documents in memory.
            A static build writes the catalogue into its output directory.
          </p>
          <Shell language="sh" lines={[SERVE, BUILD_OUT]} />
          <p>
            Keep that output directory ignored by Git. Commit your authored
            sources. See screens for schemas and saved states.
          </p>
        </>
      ),
      id: "browse-and-build",
      title: "Browse and build",
    },
  ],
  size: { desktop: "856 × 3927", mobile: "370 × 5231" },
  title: "Your first screen",
};
