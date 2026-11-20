/**
 * The documentation architecture the site depicts. Sections and
 * their page order follow the information architecture in
 * `docs/protocol/cloud/site-docs.md`; destinations the design catalogue does not
 * own render as plain text, the rule the rest of the design mockups follow.
 */

/** One documentation section and its pages, in sidebar order. */
export interface DocsSection {
  pages: readonly string[];
  title: string;
}

/** Every documentation section in the order the sidebar renders them. */
export const DOCS_SECTIONS: readonly DocsSection[] = [
  {
    pages: [
      "Install",
      "Configure",
      "Your first screen",
      "Build",
      "Serve",
      "Upgrade to the Rust core",
    ],
    title: "Getting started",
  },
  {
    pages: [
      "Config",
      "Screens",
      "Components",
      "Viewports and color schemes",
      "Folders and tags",
      "Use-case flows",
      "Pages and documents",
      "Links",
      "Review-ignore",
      "Styles",
      "Props and variants",
      "Storybook stories",
    ],
    title: "Authoring",
  },
  {
    pages: [
      "Browse",
      "Search and filters",
      "Changes",
      "Details",
      "Build and host",
    ],
    title: "Catalogue",
  },
  {
    pages: [
      "GitHub Action",
      "Publish from CI",
      "Project tokens",
      "The upload",
      "The check on a pull request",
    ],
    title: "Continuous integration",
  },
  {
    pages: [
      "serve",
      "build",
      "Validate a catalogue",
      "Build for static hosting",
      "publish",
      "Options and exit status",
    ],
    title: "CLI reference",
  },
  {
    pages: [
      "Overview",
      "Connect a repository",
      "Builds",
      "Branches and pull requests",
      "Sharing and access",
      "Workspaces and roles",
      "Settings",
      "Plans and billing",
    ],
    title: "Mokly Cloud",
  },
  {
    pages: [
      "Static export delivery",
      "Export ownership",
      "Catalogue upload",
      "Catalogue upload exchange",
      "Catalogue navigation",
      "Styled link controls",
      "Pages in the catalogue",
    ],
    title: "Reference",
  },
  {
    pages: [
      "Comments",
      "Approvals",
      "Pull request sync",
      "Agent sessions",
      "Click to reference",
    ],
    title: "Review and edit",
  },
];

/** The section and page this documentation mockup renders. */
export const DOCS_PAGE = { page: "Install", section: "Getting started" };

/** The headings the on-this-page rail lists for the depicted page. */
export const DOCS_HEADINGS = [
  { id: "install-the-package", title: "Install the package" },
  { id: "add-the-configuration", title: "Add the configuration" },
  { id: "author-your-first-screen", title: "Author your first screen" },
] as const;
