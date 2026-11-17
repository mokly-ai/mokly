/** The catalogue shell framing the real project-created dogfood screen. */

import stagedScreen from "../../../../entries/product/account/project-created.mockup";
import { siteStage } from "../../../../fixtures/site";
import { useEntryDocument } from "../../../../resource-root";
import {
  ChevronGlyph,
  ComponentGlyph,
  FolderGlyph,
  MarkGlyph,
  ScreenGlyph,
  SearchGlyph,
  TagGlyph,
} from "./glyphs.js";

type RowKind = "component" | "folder" | "screen";

interface NavigationRow {
  count?: number;
  current?: boolean;
  depth: 0 | 1 | 2;
  kind: RowKind;
  label: string;
}

interface NavigationSection {
  rows: readonly NavigationRow[];
  title: string;
}

const stagedPath = "product/account/project-created";
const folderTitles = ["Product", "Account"];
const [productFolder, accountFolder] = folderTitles;

const NAVIGATION: readonly NavigationSection[] = [
  {
    rows: [
      {
        count: siteStage.folders.product,
        depth: 0,
        kind: "folder",
        label: productFolder,
      },
      {
        count: siteStage.folders.account,
        depth: 1,
        kind: "folder",
        label: accountFolder,
      },
      {
        current: true,
        depth: 2,
        kind: "screen",
        label: stagedScreen.title,
      },
    ],
    title: "Specs",
  },
  {
    rows: [
      {
        count: siteStage.folders.design,
        depth: 0,
        kind: "folder",
        label: "Design",
      },
      { depth: 1, kind: "component", label: "Button" },
      { depth: 1, kind: "component", label: "Input" },
    ],
    title: "Components",
  },
];

function RowGlyph({ kind }: { kind: RowKind }) {
  if (kind === "folder") return <FolderGlyph />;
  if (kind === "component") return <ComponentGlyph />;
  return <ScreenGlyph />;
}

function rowClassName(row: NavigationRow): string {
  const classes = ["site-row"];
  if (row.kind === "folder") classes.push("site-row--group");
  if (row.current) classes.push("site-row--current");
  return classes.join(" ");
}

function NavigationTree() {
  return (
    <nav aria-label="Catalogue" className="site-tree">
      <div className="site-tree-head">Catalogue</div>
      <div className="site-tree-scroll">
        {NAVIGATION.map((section) => (
          <div className="site-tree-section" key={section.title}>
            <p className="site-tree-section-head">
              <span aria-hidden="true" className="site-tree-chevron">
                <ChevronGlyph />
              </span>
              {section.title}
            </p>
            {section.rows.map((row) => (
              <span
                className={rowClassName(row)}
                data-site-depth={row.depth}
                key={`${section.title}-${row.label}-${row.depth}`}
              >
                <span aria-hidden="true" className="site-row-ico">
                  <RowGlyph kind={row.kind} />
                </span>
                <span className="site-row-label">{row.label}</span>
                {row.count === undefined ? null : (
                  <span className="site-row-count">{row.count}</span>
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function ShellTopBar({ viewport }: { viewport: "mobile" | "desktop" }) {
  return (
    <div className="site-topbar">
      {viewport === "mobile" ? (
        <span aria-hidden="true" className="site-topbar-menu">
          <span />
          <span />
          <span />
        </span>
      ) : null}
      <span className="site-topbar-brand">
        <span aria-hidden="true" className="site-topbar-mark">
          <MarkGlyph />
        </span>
        {viewport === "desktop" ? "Mokly" : null}
      </span>
      <span className="site-topbar-search">
        <SearchGlyph />
        Search catalogue&#8230;
        <span aria-hidden="true" className="site-topbar-tag">
          <TagGlyph />
        </span>
      </span>
    </div>
  );
}

function ScreenHeader() {
  return (
    <div className="site-screen-head">
      <nav aria-label="Catalogue location" className="site-crumbs">
        {folderTitles.map((label, index) => (
          <span className="site-crumb" key={label}>
            {index > 0 ? (
              <span aria-hidden="true" className="site-crumb-sep">
                &#8250;
              </span>
            ) : null}
            {label}
          </span>
        ))}
      </nav>
      <div className="site-screen-title-row">
        <span className="site-screen-title">{stagedScreen.title}</span>
        <span className="site-idchip">#{stagedPath}</span>
      </div>
    </div>
  );
}

/** The staged screen's generated document, named by Mokly from its path. */
function useStagedDocument(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): string {
  return useEntryDocument(stagedPath, viewport, colorScheme);
}

function StageScreen({ viewport }: { viewport: "mobile" | "desktop" }) {
  const light = useStagedDocument(viewport, "light");
  const dark = useStagedDocument(viewport, "dark");
  return (
    <div className="site-stage-frame">
      <iframe
        className="site-stage-screen site-stage-screen--light"
        sandbox="allow-same-origin allow-scripts"
        src={light}
        tabIndex={-1}
        title={`${stagedScreen.title}, ${viewport}, light`}
      />
      <iframe
        className="site-stage-screen site-stage-screen--dark"
        sandbox="allow-same-origin allow-scripts"
        src={dark}
        tabIndex={-1}
        title={`${stagedScreen.title}, ${viewport}, dark`}
      />
    </div>
  );
}

/** The framed Browse shell and the real generated product document it names. */
export function CatalogueFrame({
  viewport,
}: {
  viewport: "mobile" | "desktop";
}) {
  return (
    <figure className="site-frame">
      <div className="site-frame-head">
        <span className="site-frame-label">{siteStage.label}</span>
        <span className="site-badge site-badge--success">
          <span aria-hidden="true" className="site-badge-dot" />
          {siteStage.status}
        </span>
      </div>
      <div className="site-shell">
        <ShellTopBar viewport={viewport} />
        <div className="site-shell-body">
          {viewport === "desktop" ? <NavigationTree /> : null}
          <div className="site-shell-main">
            <ScreenHeader />
            <div className="site-stage">
              <p className="site-stage-label">{viewport}</p>
              <StageScreen viewport={viewport} />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="site-frame-foot">
        <span className="site-frame-foot-label">Screen</span>
        {stagedScreen.title}
      </figcaption>
    </figure>
  );
}
