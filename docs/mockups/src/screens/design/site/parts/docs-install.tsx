/**
 * The Install guide, word for word from the workspace package's
 * `docs/guides/start/install.md`: its five sections, with each shell
 * command in a code panel under its fence language and a `$` prompt. The
 * version follows the workspace `@mokly/mokly` package, as the guide's
 * release markers keep it.
 */

import { CodePanel, type CodeLine } from "./code_panel.js";
import type { DocsPage } from "./docs-pages.js";
import { PACKAGE_VERSION } from "./version.js";

/** One shell command, as the guide's `shell` fence renders it. */
function Shell({ line }: { line: CodeLine }) {
  return <CodePanel language="shell" lines={[line]} prompt />;
}

const INSTALL_MOKLY: CodeLine = [
  ["fn", "npm"],
  " ",
  ["keyword", "install"],
  " ",
  ["attr", "--save-dev"],
  " ",
  ["string", "@mokly/mokly"],
];

const INSTALL_REACT: CodeLine = [
  ["fn", "npm"],
  " ",
  ["keyword", "install"],
  " ",
  ["attr", "--save-dev"],
  " ",
  ["string", "react"],
  " ",
  ["string", "react-dom"],
];

const RUN_LOCAL: CodeLine = [
  ["fn", "npx"],
  " ",
  ["attr", "--no-install"],
  " ",
  ["type", "mokly"],
  " ",
  ["attr", "--version"],
];

const RUN_RELEASE: CodeLine = [
  ["fn", "npx"],
  " ",
  ["attr", "--package"],
  " ",
  ["string", "@mokly/mokly"],
  " ",
  ["type", "mokly"],
  " ",
  ["attr", "--help"],
];

const PIN_VERSION: CodeLine = [
  ["fn", "npm"],
  " ",
  ["keyword", "install"],
  " ",
  ["attr", "--save-dev"],
  " ",
  ["string", "@mokly/mokly"],
  ["number", `@${PACKAGE_VERSION}`],
];

/** The Install page, the first guide of Getting started. */
export const INSTALL_PAGE: DocsPage = {
  description:
    "Add Mokly to the repository that holds the components your screens are made of.",
  file: "start/install.md",
  next: {
    description: "Tell Mokly which authored files belong to the catalogue.",
    section: "Getting started",
    title: "Configure",
  },
  previous: {
    description:
      "Install Mokly, describe your catalogue and open your screens in the browser.",
    section: "Documentation",
    title: "Getting started",
  },
  section: "Getting started",
  sections: [
    {
      body: (
        <>
          <p>
            Mokly runs from your own repository as a development dependency.
          </p>
          <Shell line={INSTALL_MOKLY} />
          <p>
            An HTML-only catalogue needs neither React nor React DOM. Screens
            and components written in React need React and React DOM 19 or newer
            in your repository. Install them when your repository does not have
            them yet:
          </p>
          <Shell line={INSTALL_REACT} />
          <p>
            The package is <code>@mokly/mokly</code> and its executable is{" "}
            <code>mokly</code>. This documentation describes version{" "}
            {PACKAGE_VERSION}.
          </p>
        </>
      ),
      id: "install-the-package",
      title: "Install the package",
    },
    {
      body: (
        <>
          <p>
            Run the local executable with <code>npx</code>. In a repository that
            has Mokly as a development dependency, <code>--no-install</code>{" "}
            keeps npm from reaching the registry.
          </p>
          <Shell line={RUN_LOCAL} />
          <p>
            On a machine without the dependency you can run one published
            release directly:
          </p>
          <Shell line={RUN_RELEASE} />
        </>
      ),
      id: "run-the-command",
      title: "Run the command",
    },
    {
      body: (
        <>
          <p>
            To reproduce one exact release, on another machine or in a job,
            install the version rather than the range:
          </p>
          <Shell line={PIN_VERSION} />
        </>
      ),
      id: "pin-a-version",
      title: "Pin a version",
    },
    {
      body: (
        <ul>
          <li>
            Node.js 22.15 or newer, excluding Node 23 and Node 24.14 through
            24.18. If you use Node 24, select 24.19 or later to avoid the
            affected runtime releases. On an excluded version, the install
            succeeds and <code>mokly</code> stops at its first command with a
            message that names the Node version to install.
          </li>
          <li>
            A repository that holds your screens and components, or somewhere to
            write new ones.
          </li>
          <li>Git, once you want to compare a branch with its base.</li>
        </ul>
      ),
      id: "what-you-need",
      title: "What you need",
    },
    {
      body: <p>Configure where Mokly finds your screens.</p>,
      id: "next",
      title: "Next",
    },
  ],
  size: { desktop: "856 × 2718", mobile: "370 × 3195" },
  title: "Install",
};
