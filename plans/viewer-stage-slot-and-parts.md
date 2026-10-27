# Viewer Stage Slot And Shell Parts

Status: Active. On branch `conductor/viewer-stage-slot-plan`, no pull request yet. The plan closes when its PR merges.

Mokly Cloud hosts `@mokly/viewer` as its product and puts its own controls in
the viewer's slots. It also draws 24 mockups of its app with the real viewer
inside. With viewer 0.5.0, each mockup inserted the HTML that `renderViewer`
returned. Release 0.16.0 removed `@mokly/viewer/server`, `renderViewer`, and
shell hydration, so those mockups no longer build. On 2026-10-26 Mokly Cloud
rendered `MoklyViewer` 0.16.1 with React's static renderer. The shell
rendered, but the stage showed "Loading preview…" and the `stageOverlay` slot
stayed hidden. Mokly's document URL policy also refused the root-absolute
links. The [viewer contract](../docs/protocol/mokly-viewer.md) says that the
viewer renders only in the browser.

This change adds four things to `@mokly/viewer`:

1. A `stage` slot. It is a host function that replaces the stage of the
   selected entry. The viewer keeps everything around the stage.
2. Every shell part as an exported component, so that a host can assemble its
   own layout. `MoklyViewer` stays the default assembly of these parts.
3. Supported static rendering of `MoklyViewer` and every part with React's
   server renderer. The repository gate tests it.
4. Full link addresses in an embedded root, so that static HTML passes Mokly's
   document URL policy without changes.

The change does not cover private catalogue credentials, or host transports for
comparisons, previews, and the standalone shell. It does not support the
hydration of static HTML. It needs no CLI or Rust core change. Milestone 7 adds
only a CLI integration test.

Contract owners:

- The [embeddable viewer contract](../docs/protocol/mokly-viewer.md), and the
  pages that Milestone 1 adds beside it: `mokly-viewer-selection.md`,
  `mokly-viewer-shell-tree.md`, `mokly-viewer-parts.md`,
  `mokly-viewer-stage.md`, and `mokly-viewer-static-render.md`.
- The [markers](../docs/protocol/mokly-viewer-markers.md),
  [component explorer](../docs/protocol/mokly-component-explorer.md), and
  [Scroll together](../docs/protocol/mokly-comparison-scroll-together.md)
  contracts.
- The [package boundary](../docs/architecture/package-boundary.md).
- The [viewer README](../packages/viewer/README.md), its
  [API reference](../packages/viewer/docs/api/README.md) and
  [core concepts](../packages/viewer/docs/concepts/README.md), and the
  [shell README](../packages/viewer/src/shell/README.md).
- The [npm release notes](../docs/protocol/npm-release-notes.md).

## Request And Amended Decision

- **Request, 2026-10-26.** Cal asked for this plan for Mokly Cloud. On
  2026-10-26 the user chose option H of Decision 6 in the Mokly Cloud plan
  `plans/mokly-rust-core-upgrade.md` on branch `calummoore/mokly-cli-upgrade`
  of `mokly-ai/mokly-cloud`. Mokly Cloud adopts the release in its own pin
  bump.
  - Option H, in that plan's words: the Mokly change "adds a `stage` slot whose
    content replaces the stage of the selected entry, exports each shell part,
    supports static rendering with object sources, and writes full link
    addresses in a static render".
  - The user rejected these options: A, a neutral stage area. B, a
    replacement for `renderViewer`. C, a hand-drawn copy of the viewer shell.
    D and E, the unsupported static render with patched HTML. F, a static
    render with up-front entry data. G, exported parts alone.
- **Amended decision, 2026-10-26.** Option H amends Decision 21 of the
  [Rust rebuild plan](./rust-rebuild.md), dated 2026-10-13. Serve and `build`
  still render the Browse shell only in the browser. A React host can now also
  render `MoklyViewer` and its parts to static HTML. Hydration stays retired.

## Decisions

The plan asked for the decisions below on 2026-10-27. The user answered
Decisions 1, 7, 8, and 9 the same day. Decisions 2 to 6 stay open. The user
asked for more detail on Decisions 2, 3, 4, 6, and 7. Each open decision shows
the recommended option. The design and the milestones assume that option. Another
answer changes the milestones that the decision names.

1. **Composition model, High.** Decided: A, by the user on 2026-10-27.
   - A: One root element. Every part renders inside it, in any host layout.
   - B: A provider without an element. Parts render anywhere in the host page,
     and each part has its own style and event scope.
   - C: Regions only. The entry layout stays internal.
   - Reason: one element keeps one event delegate, one focus target, and one
     marker layer. B needs new mechanics for each of them. C does not meet the
     request. The styles are scoped to each part, under the review decisions
     below. Affects Milestones 1, 3, and 4.
2. **Link addresses, High.** Open. Recommended: B.
   - A: Full addresses only in a static render. The browser keeps
     root-absolute links.
   - B: Full addresses at the artifact origin root in every render of an
     embedded root. The standalone shell keeps root-absolute links.
   - C: B, plus a host function that maps each link to a host route.
   - Reason: B gives the same markup in the browser and the server. A modified
     click then opens the catalogue's own page, not a path on the host's
     origin. C is a larger API that no host asked for. Affects Milestones 1,
     6, and 9.
   - Scope: the request asks for the scope of A, full addresses in a static
     render. B goes further, because it also changes the browser links of
     every embedded host.
3. **Entry details in a static render, High.** Open. Recommended: A.
   - A: In a static render, the viewer calls `detail` during the render and
     uses each entry detail object that it returns.
   - B: A new `details` prop of entry details that the host holds.
   - C: No details. The parts that need a detail show their loading state.
   - Reason: A meets the "every source is an object" rule with no new prop. The
     browser keeps the `detail` call after mount. Affects Milestones 1, 6, and 7.
   - Note: the user rejected option F of Decision 6, a static render with
     up-front entry data, and chose option H. Options A and B here also give a
     static render entry data, but beside the stage slot of option H. The user
     decides whether that rejection covers them.
4. **Stage overlay placement, Medium.** Open. Recommended: D, since
   2026-10-27, when the user asked what the overlay is for.
   - A: The overlay renders inside the stage part, and CSS places it over the
     stage canvas. Its content remounts when the selection moves to another
     workspace.
   - B: The browser keeps the measured overlay beside the main area. Only a
     static render uses CSS.
   - C: The overlay stays beside the main area, and CSS anchor positioning
     places it.
   - D: Remove the `stageOverlay` slot and the planned `MoklyStageOverlay`
     part. A host draws a card over the whole stage with `stage`, and content
     on one component with markers.
   - Reason: Mokly Cloud's one documented use is a card that offers to open a
     private catalogue in a new tab when a comparison fails. The `stage`
     function covers that use, so D removes the measurement problem instead of
     solving it. D deletes a shipped slot, so it needs the user's approval. A
     gives one placement for both renders. B keeps two placements. C needs CSS
     anchor positioning, which Chrome 125, Safari 26, and Firefox 147 support.
     Affects Milestones 1, 4, and 9.
5. **Inspection and markers with a host stage, Medium.** Open. Recommended: A,
   as the request recommends.
   - A: Inspection is unavailable. Highlight components is disabled with a
     reason, and no instance event fires. The highlight, scroll, and pick
     handle methods reject, and every marker reports `unavailable`.
   - B: A new API through which the host stage reports instance boxes.
   - Reason: instance geometry exists only inside Mokly's own frames. Affects
     Milestones 1, 2, and 5.
6. **Comparison modes with a host stage, Medium.** Open. Recommended: A, as the
   request recommends.
   - A: The mode group stays, and the stage function receives the selected
     mode. No comparison loads, and Scroll together is absent.
   - B: The mode group is absent, and the mode is always Current.
   - C: The viewer loads the comparison and gives its documents to the host.
   - Reason: the host keeps the reader's mode choice, and Scroll together moves
     only the viewer's own panes. Affects Milestones 1, 2, 3, and 5.
7. **Device frames, Medium.** Decided: B, by the user on 2026-10-27. The plan
   had recommended A.
   - A: Export `MoklyDeviceFrame`, the labelled phone or browser frame of one
     viewport.
   - B: Export the bare `MoklyPhoneFrame` and `MoklyBrowserFrame` chrome.
   - C: No export. The host copies the design.
   - Result: the host places each frame and labels it if it wants. Each frame
     still takes the colour scheme of its screen, so the status band and the
     screen surface stay readable. Affects Milestones 1, 5, and 7.
8. **Stability promise, Low.** Decided: A, by the user on 2026-10-27.
   - A: One promise for every export. The documented props, composition rules,
     and behaviour are the API. A breaking change ships only in a minor
     release, with an upgrade note.
   - B: Promise A for the root, the region parts, and the device frames. The
     entry parts and the tab parts are experimental.
   - Reason: the package is pre-1.0 and already follows rule A. One tier is
     simpler for hosts. Affects Milestones 1 and 8.
9. **Shape of the host content props, Low.** Decided: C, by the user on
   2026-10-27. The user had asked whether the `slots` object is an
   anti-pattern.
   - A: `slots` holds the host content and the `stage` function.
   - B: `slots` holds only host content. `stage` is its own prop on
     `MoklyViewer`, as on `MoklyViewerRoot`.
   - C: Flat props replace `slots`: `topBarStart`, `topBarEnd`, `railStart`,
     `railEnd`, `emptyState`, `sidePanel`, `stageOverlay`, and `stage`.
     `sidePanel` and `stageOverlay` keep their object values, so each
     required pair stays together.
   - D: `MoklyViewer` takes no host content. A host with its own content
     composes the root and the parts.
   - Reason: with C, every prop has one shape, like the other props and the
     parts. `stage` stands beside the other behaviour props. The break is cheap
     while Mokly Cloud upgrades. The removal of the public `ViewerSlots` type
     needs a line in the npm release notes. The request put `stage` in
     `ViewerSlots`, so C changes the request. Affects Milestones 1, 4, 5, 8,
     and 9.

The plan also makes three choices that a review can change: the flat `Mokly*`
export names, the `stage` prop on the root, and a warning without a throw for a
misplaced part.

On 2026-10-27 the user also answered these items of the plan review:

- **Review 1 finding 2: B.** Each part is its own style scope. Host layout
  elements between the parts get no viewer styles. Rejected: A, which let them
  get the viewer's base rules, such as `box-sizing`.
- **Review 1 finding 4: A.** In a static render, a throw from `detail` reaches
  the host's React error handling. A detail that fails its checks shows the
  browser's failure state without Try again. No event callback fires.
  Rejected: B, every failure shows the failure state, and C, every failure
  throws.
- **Review 1 finding 5: B.** Two named test helpers, one for the browser's
  first render with pending details and one for a static render with object
  details. Rejected: A, pending details in the one helper.
- **Review 1 finding 6: B.** One static render check that both
  `npm run package:smoke` and the release consumer smoke call. Rejected: A, a
  push to the release check branch.
- **Review 2, wider fix of finding 5: B.** The Markdown link check covers every
  Markdown file under `packages/`. Rejected: A, the rule that each package page
  is named `README.md`.
- **Review 1 finding 3: C.** With no catalogue part, every menu button hides.
  `MoklyMenuButton` opens the drawer from a host's own header. With no menu
  button, the catalogue stays a column. A part can render inside slot content.
  Rejected: A, the top bar and the catalogue together and a rejection of parts
  in slot content, and B, CSS fallbacks with a part in slot content that
  renders nothing.
- **Review 2 finding 1: B.** `MoklyInspector` and `MoklyEntryHeader` take their
  inner parts as children. A real repeat of a part renders nothing and warns.
  Rejected: A, the warning without the children, because a host could not
  move one tab body into its own panel.

## Design

### Stage Slot

```ts
type ComparisonMode = "current" | "side" | "overlay" | "difference";
interface ViewerStageContext {
  kind: "screen" | "component" | "page" | "document" | "use-case";
  /** The selected entry. A variant is selected by its own path. */
  path: string;
  title: string;
  /** The parent entry of a selected screen or component variant. */
  variantOf?: string;
  /** The identity of a selected removed record. */
  snapshotId?: string;
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  comparison: ComparisonMode;
  /** The validated logical fragment of the route. */
  fragment?: string;
}
type ViewerStage = (context: ViewerStageContext) => ReactNode;
interface MoklyViewerProps {
  // The other props of today stay. Flat props replace `slots`.
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  railStart?: ReactNode;
  railEnd?: ReactNode;
  emptyState?: ReactNode;
  sidePanel?: { content: ReactNode; width: CSSProperties["width"] };
  stageOverlay?: { content: ReactNode; pointerEvents: "none" | "auto" };
  stage?: ViewerStage;
}
```

- The viewer calls `stage` when it renders the stage of a selected entry,
  current or removed. It calls the function again on each later render. Home
  and the not-found view do not call it. Home keeps `emptyState`.
- The result `undefined` keeps the viewer's own stage. Every other result,
  `null` included, replaces it. This document calls the result a host stage.
- A host stage replaces the device frames, the documents, the flow steps, the
  previous-version preview, and the comparison panes.
- For a host stage, the viewer mounts no frame. It requests no comparison and
  no previous-version document. It still loads the entry detail, because the
  header status and the inspector read it.
- The host stage sits on the stage canvas: the dotted surface, its padding, its
  scrolling, and the frame arrangement of the viewer's own stage. It is slot
  content, so viewer styles and link handling do not reach it.
- The function must be pure, because React can render more than once. A throw
  from it reaches the host's React error handling.
- Each variant is its own entry under the
  [variant contract](../docs/protocol/mokly-variants.md). So `path` names the
  selected variant, and `variantOf` names its parent. A component parent shows
  its own variant.
- The root holds the `stage` function. The entry state then knows before any
  effect runs whether a host stage shows.

### Exported Parts

| Export                                                                        | Props                                                                         | Renders                                                                                                            | Placement                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `MoklyViewerRoot`                                                             | The `MoklyViewer` props without the seven host content props, plus `children` | The viewer element, skip link, marker and label layers, and status region. Loading and failure replace `children`. | The host page                  |
| `MoklySlot`                                                                   | `children`, `className`, `style`                                              | A host-owned container                                                                                             | The root                       |
| `MoklyTopBar`                                                                 | `start`, `end`                                                                | The menu button, brand, search, tag picker, and preview scheme switch                                              | The root                       |
| `MoklyCatalogueNav`                                                           | `start`, `end`                                                                | The catalogue rail, which is a drawer below the layout breakpoint                                                  | The root                       |
| `MoklyMenuButton`                                                             | None                                                                          | The menu button that opens the catalogue drawer below the layout breakpoint                                        | The root                       |
| `MoklyMain`                                                                   | `emptyState`, `children`                                                      | The `main` region: home, the not-found view, or the selected entry                                                 | The root, once                 |
| `MoklyEntryHeader`                                                            | `children`, `end`                                                             | Breadcrumbs, title, path chip, status, and its `children` in the action area, by default `MoklyViewControls`       | `MoklyMain`                    |
| `MoklyViewControls`                                                           | None                                                                          | The viewport, Dark preview, and Highlight components controls                                                      | `MoklyMain`                    |
| `MoklyVariantBar`                                                             | None                                                                          | The saved variants of a component                                                                                  | `MoklyMain`                    |
| `MoklyComparisonToolbar`                                                      | None                                                                          | The mode group, Scroll together, and Refresh                                                                       | `MoklyMain`                    |
| `MoklyStage`                                                                  | `children`                                                                    | The stage canvas, the edit status, the inspection masks, and its overlays                                          | `MoklyMain`                    |
| `MoklyStageOverlay`                                                           | `pointerEvents`, `children`                                                   | Host content over the stage canvas                                                                                 | `MoklyStage`                   |
| `MoklyInspector`                                                              | `children`                                                                    | The details panel. For a screen or component, each child tab body is one tab, and the default is all four tabs.    | `MoklyMain`                    |
| `MoklyEntryDetails`, `MoklyInstanceList`, `MoklyPropsPanel`, `MoklyUsageList` | None                                                                          | The body of the Details, Components, Props, or Usage tab                                                           | `MoklyMain`                    |
| `MoklyPhoneFrame`                                                             | `children`, `colorScheme`                                                     | The phone chrome: bezel, notch, status band, screen surface, and home pill                                         | The root, also in slot content |
| `MoklyBrowserFrame`                                                           | `children`, `address`, `colorScheme`                                          | The browser window chrome: lights, the address pill with copy, expand, and the viewport surface                    | The root, also in slot content |

`start` and `end` take host content before and after a part, as the matching
props of `MoklyViewer` do. `MoklyEntryHeader` takes `end` after its action
area. When a part's `children` are `undefined`, the part keeps its default
inner parts. `null` leaves the area empty. Every part can also render inside
slot content. `MoklyMain` lays out the selected entry with its `children`, or with
the default entry layout when it has none. The same `children` serve every
entry kind. Home and the not-found view do not render them. The two frames
draw no viewport label, and their `colorScheme` defaults to the selected
scheme. The root entry also exports `ViewerStage`, `ViewerStageContext`,
`ComparisonMode`, `MoklyViewerRootProps`, and the props type of each part.

`MoklyViewer` renders the root with its default layout: the top bar with
`topBarStart` and `topBarEnd`, the catalogue with `railStart` and `railEnd`,
the main part with `emptyState`, and the `sidePanel` content. Its default
stage holds the `stageOverlay` content as a `MoklyStageOverlay`. The standalone shell
renders the same internal parts in its own root.

### Composition Rules

1. Every part renders inside one `MoklyViewerRoot` element, not through a
   portal outside it.
2. The entry parts render inside `MoklyMain`. `MoklyStageOverlay` renders
   inside `MoklyStage`.
3. A root holds one `MoklyMain`. It holds at most one of each other part,
   except `MoklySlot`, `MoklyPhoneFrame`, and `MoklyBrowserFrame`. In the
   browser, a second part of one kind renders nothing and warns once. A root
   without `MoklyMain` also warns once.
4. The host owns the layout elements between the root and the parts. Viewer
   styles do not reach them, because each part is its own style scope.
5. Host content, such as text, controls, and links, goes in a part's slot prop
   or in a `MoklySlot`. Viewer styles and link handling do not reach it.
6. A part can render inside slot content. It keeps its own styles there. The
   nearest part or slot decides whether the viewer handles a link click.
7. A part outside its required ancestor renders nothing. It logs one console
   warning that names the part and the ancestor.
8. The root fills its container, which needs a definite height. Each part
   fills the box of its layout element.
9. `MoklyMain` remounts its children when the selected entry's workspace
   changes. The variants of one component share one workspace.

Behaviour across parts, in every layout that follows these rules:

- The root's skip link moves focus to the main part.
- The root's status region announces each committed navigation.
- The root handles Escape for the tag picker, the expanded frame, and the open
  inspector. It is also the focus target of a pick.
- Below the layout breakpoint, a menu button opens the catalogue part as a
  drawer over the root, below the top bar part when the root has one. The top
  bar holds a menu button, and `MoklyMenuButton` places one anywhere else.
- With no catalogue part, every menu button hides. With no menu button, the
  catalogue part stays a column below the breakpoint.
- Below the layout breakpoint, the inspector part is a bottom sheet over its
  nearest positioned container. `MoklyMain` is positioned. The sheet and the
  desktop divider size against that container.
- The marker and label layers belong to the root. They follow the frames and
  clip to the stage part in every layout.
- The top bar's preview scheme switch hides while the view controls show the
  Dark preview control.

### State Flow

- The root owns the sources, the index, the held details, the selection, and
  the route. It also owns the disclosures, the drawer, search and tags, the
  inspector state, the expanded frame, announcements, the frame registry, the
  comparison environment, and the identifier prefix.
- React context carries the root's state to the parts.
- `MoklyMain` owns the route view. For a selected entry, it provides the entry
  state, keyed by the workspace key.
- The entry state holds the comparison mode and its requests, the temporary
  prop edits, the inspection state, the selected instance, and the result of
  the `stage` function.
- Parts take no state props. A host changes state only through the root's props
  and its handle.
- Part markers do not use Mokly's reserved document names: `data-mokly-link*`,
  `mokly-instance`, and `mokly-` comments. Hosts render the viewer inside
  Mokly screens.
- Each part's element is a style scope root. The scope of a part ends at a
  nested part and at slot content. The root's scope holds only the root's own
  elements: the skip link, the layers, and the status region.
- A rule that reads root state, such as the drawer, the theme, or the expanded
  frame, reaches the root through an ancestor selector of the part's scope.

### Static Rendering

- A static render is a render by React's server renderer, such as
  `renderToStaticMarkup`, `renderToString`, or `react-dom/static`. No effect
  runs in it.
- With an object `index` and its `baseUrl`, `MoklyViewer` and every part render
  the selection as finished HTML.
- In a static render, the viewer calls `detail` during the render for each
  detail of the first view. These are the selected entry's detail and the
  detail of each step screen of a use case.
- The viewer adopts each entry detail object under the detail fences. A URL or
  a promise leaves the parts that need that detail in their loading state.
- A throw from `detail` reaches the host's React error handling. A detail that
  fails its fences shows the browser's failure state for that case, without
  Try again. No event callback fires in a static render.
- With a host stage and object details, no part shows a loading state.
- Without a host stage, the viewer's own stage renders frames with full `src`
  addresses. The previous-version preview and the comparison panes show their
  loading state, because the browser fetches their documents.
- The stage overlay and `emptyState` render visible content.
- The same props give the same HTML. The render reads no clock, random value,
  storage, media query, or other browser global.
- A browser mounts a new root. It does not hydrate static HTML.

### Link Addresses

- An embedded root writes each catalogue link as a full `http:` or `https:`
  address at the artifact origin root. This applies in the browser and in a
  static render.
- A same-document link, such as the skip link, stays a fragment link.
- An unmodified primary click on a catalogue link still proposes the
  selection. A modified click opens the address.
- The standalone shell keeps root-absolute links on its own origin.
- Rejected: relative links, because Mokly's public closure checks them as local
  files. Also rejected: root-absolute links in Mokly screens, because the
  document URL policy refuses them for portability.

### Stability

The documented props, composition rules, and behaviour of every export are the
API. Markup, class names, data attributes, and private custom properties are
not. The three accent custom properties stay the only style extension point. A
breaking change ships only in a minor release, with an upgrade note in the npm
release notes.

## Milestone 1: Documentation And Protocol

Write the requirements and the decisions in force before any code changes. The
viewer contract is at its exact cap of 396 lines, so split it first.

- [ ] Split `docs/protocol/mokly-viewer.md` in its own commit, with no
      requirement change.
  - [ ] Move `Selection, Events And Imperative Use` to
        `mokly-viewer-selection.md`.
  - [ ] Move `Shell Tree And State` to `mokly-viewer-shell-tree.md`.
  - [ ] Keep every page at or below 250 lines, and remove the
        `mokly-viewer.md` entry from `xtask/protocol-document-caps.json`.
  - [ ] Update every link to a moved anchor.
- [ ] `mokly-viewer.md`: list `MoklyViewerRoot`, the parts, and their types in
      the root entry. Replace `slots` and `ViewerSlots` with the flat host
      content props, and add `stage`. Replace "renders only in the
      browser" with the static render rule, and link the new pages.
  - [ ] The `detail` paragraph: the viewer also calls `detail` during a static
        render.
  - [ ] The theming paragraph: each part is its own style scope. Scoped
        styles exclude host layout elements and slot content, except a frame
        part inside slot content.
  - [ ] The root entry item says that a React host renders the viewer in the
        browser. Add that it can also render it statically.
  - [ ] The sentence "Every delivery renders the shell from data in the
        browser" applies to Serve and `build` only.
- [ ] `mokly-viewer-shell-tree.md`: Serve and `build` render the tree in the
      browser. A React host can also render it statically.
- [ ] `mokly-package.md`: the package table says that the viewer is "the
      Browse shell, rendered in the browser". Add the static render. Keep the
      line count.
- [ ] Add `mokly-viewer-parts.md`: the exports, the composition rules, the
      behaviour across parts, the state rule, and the stability promise, with
      Decisions 1 and 8 in force.
- [ ] Add `mokly-viewer-stage.md`: the stage function and its context, the
      `undefined` rule, and what a host stage loads. Add comparison modes,
      inspection, markers, the two frame parts, and the stage overlay, with
      Decisions 4 to 7 in force.
- [ ] Add `mokly-viewer-static-render.md`: what a static render shows, the
      `detail` rule and its failures, determinism, link addresses, and the gate
      tests, with Decisions 2 and 3 in force. Record hydration as rejected.
- [ ] `mokly-viewer-markers.md`: a host stage has no frame, so each marker is
      `unavailable`.
- [ ] `mokly-component-explorer.md`: a host stage disables Highlight
      components. The page has 249 lines, so add at most one line or split it.
- [ ] `mokly-comparison-scroll-together.md`: Scroll together is absent with a
      host stage.
- [ ] `mokly-runtime.md`: limit "rendered only in the browser" to Serve and
      `build`. Add no line, because the page has 250 lines.
- [ ] `docs/architecture/package-boundary.md` and `rust-core.md`: Serve and
      `build` render the shell in the browser. A React host can render the
      viewer statically.
- [ ] `npm-release.md` and `packed-consumer-smoke.md`: the release consumer
      smoke and `npm run package:smoke` also render the installed viewer
      statically, through one shared check.
- [ ] `docs/protocol/README.md`: list the five new pages under Viewer.
- [ ] Give each page that this milestone adds or changes this plan's status
      line. Where a page has the stale line of the completed Rust rebuild plan,
      replace that line, so the page keeps its line count.
- [ ] Check the Markdown: `npm run format:check`,
      `node --import tsx --test tests/markdown_links.test.ts`, and
      `cargo xtask source-file-length-lint` after a fetch of `origin/main`.

## Milestone 2: Design Mockups

Tags: mockup

Change the shared design components before the UI changes.

- [ ] Add a `host-stage` variant to the view controls in
      `examples/basic/specs/design/library/controls/`. Its Highlight
      components control is disabled with the host stage reason. The draft copy
      is "Highlighting is available in catalogue previews." Settle the words
      under the `product-ui` copy rules.
- [ ] Add a `host-stage` variant without Scroll together to the comparison
      toolbar in the same directory.
- [ ] Update `docs/protocol/mokly-design-component-library.md`: both variant
      lists, item 4 with the toolbar state without Scroll together, and item 5
      with the host stage reason. Item 5 also omits the `loading` reason that
      the view controls accept, so add it there.
- [ ] Add `host-stage` to the `comparison-toolbar` and `view-controls` rows of
      `tests/browser/design_library_inventory.ts`. Then run
      `npm run test:browser -- tests/browser/design_adoption.spec.ts`.
- [ ] Run the mockup check of `AGENTS.md`. Smoke-test both new variants in the
      mobile and desktop views through `npm run dev`.

## Milestone 3: Internal Shell Parts

Tags: ui

Refactor the shell into internal parts and an entry state provider. The markup
and the behaviour do not change. `MoklyViewer` and the standalone shell render
through the new parts.

- [ ] Save the static markup of the embedded and standalone shells for every
      fixture route, with and without held details, under
      `.context/viewer-stage-slot-and-parts/markup-before/`.
- [ ] Move the entry state of `ComponentWorkspace` into an entry provider keyed
      by `workspaceKey`. The state is the comparison controller, the component
      controls, the inspection, the active viewport, and the selected instance.
- [ ] Give the page evidence and the previous-version data of `TargetView` the
      same provider.
- [ ] Split the comparison controller into its mode state and its request
      lifecycle. Milestone 5 then keeps the mode without a request.
- [ ] Split `ComponentWorkspace`, `TargetView`, and `ControlledDiffScreen` into
      internal parts: the entry header, view controls, variant bar, comparison
      toolbar, stage, inspector, and the four tab bodies.
- [ ] Add a default entry layout that gives the same DOM as today.
- [ ] Replace each lookup of a default-layout wrapper with a ref that a part
      registers in the entry provider.
  - [ ] Find the lookups with a search of `packages/viewer/src` for
        `[data-workspace]`, `.mbk-workspace`, and `.mbk-workspace-panes`. Save
        the search output under `.context/viewer-stage-slot-and-parts/`.
  - [ ] The known lookups find the Props tab, the inspector divider, the
        component controls, the inspection geometry root with its Escape
        listener, and the Highlight components button for focus return.
- [ ] Keep each file at or below 300 lines, near 200.
- [ ] Compare the markup with the saved copy. It must match byte for byte.
- [ ] Run the viewer Node tests and the browser suite. Both pass unchanged.

## Milestone 4: Public Parts And Composition

Tags: ui

Export the root and the parts under the composition rules. `MoklyViewer`
becomes the default assembly of the public parts.

- [ ] Add `MoklyViewerRoot` with the source, selection, failure, and handle
      logic of `MoklyViewer`. `MoklyViewer` renders the root and the default
      layout.
- [ ] Replace `slots` on `MoklyViewer` with the flat host content props, under
      Decision 9. Move every host in the repository to them, such as the
      browser harness and the release browser smoke.
- [ ] Add `MoklySlot` and the public parts over the internal parts. Each part
      checks its required ancestor and marks its element. A misplaced part
      renders nothing and warns once.
- [ ] Apply review 1 finding 3 C: add `MoklyMenuButton`. Through CSS on part
      markers, every menu button hides without a catalogue part, and the
      catalogue stays a column without a menu button.
- [ ] Let a part render inside slot content. The click handler picks the
      nearest part or slot to decide who owns a link.
- [ ] Apply review 2 finding 1 B: `MoklyInspector` and `MoklyEntryHeader` take
      their inner parts as children. In the browser, a second part of one kind
      renders nothing and warns once, and a root without `MoklyMain` warns.
- [ ] Make each part its own style scope in the scoped stylesheet. A part's
      scope ends at a nested part and at slot content. The root rules apply
      only to the root's own elements.
  - [ ] Rewrite the rules that read root state, such as the drawer, the theme,
        and the expanded frame, so that each part scope reaches the root
        through an ancestor selector.
  - [ ] Browser check: a host layout element between parts keeps its own
        `box-sizing`, margins, and link colour.
- [ ] Key the CSS between parts on part markers, not on the wrappers of the
      default layout. Examples are `.mbk-workspace [hidden]` and
      `:has(.mbk-workspace)`.
- [ ] Render the stage overlay inside `MoklyStage`, placed by CSS over the
      stage canvas, under Decision 4. Remove the measurement of
      `EmbeddedStageOverlay`. Map the `stageOverlay` slot to
      `MoklyStageOverlay`.
- [ ] Render `emptyState` inside `MoklyMain`, in place of the home body.
- [ ] Keep the catalogue drawer against the root. Place the inspector sheet and
      its divider against the nearest positioned container.
- [ ] Export the parts and their props types from the root entry.
- [ ] Node tests: each part renders inside a root from the fixture catalogue. A
      misplaced part renders nothing and warns once. The default assembly
      keeps the slot behaviour of `embedded_viewer_render.test.tsx`.
- [ ] Tests for each new rule: no catalogue part, no top bar with and without
      `MoklyMenuButton`, a part inside slot content, a tab body outside the
      inspector, a repeated part, and a root without `MoklyMain`.
- [ ] Browser spec for a custom layout: the catalogue on the right, the
      inspector beside the stage, and host content in `MoklySlot`.
  - [ ] It checks the drawer, the skip link, Escape, announcements, and the
        focus after a pick.
  - [ ] It checks markers, inspection labels, the inspector sheet and divider,
        link handling, and the overlay bounds.
- [ ] Compare the overlay in `tests/browser/viewer_lifecycle.spec.ts` with the
      box of the stage part.
- [ ] Smoke test: open the default and the custom layout in Chrome. Open the
      standalone shell through `npm run dev`.

## Milestone 5: Stage Slot

Tags: ui

Add the host stage under Decisions 5, 6, and 7.

- [ ] Add `ViewerStage`, `ViewerStageContext`, `ComparisonMode`, the root's
      `stage` prop, and the `stage` prop of `MoklyViewer`.
- [ ] The entry provider calls `stage` during its render. A result that is not
      `undefined` shows a host stage. No frame mounts, and no comparison or
      previous-version request starts.
- [ ] Render the host stage as slot content on the stage canvas.
- [ ] Comparison toolbar with a host stage: the mode group without Scroll
      together. The selected mode reaches `comparison`.
- [ ] Inspection with a host stage:
  - [ ] Highlight components is disabled with the reason of Milestone 2.
  - [ ] No instance hover or click event fires.
  - [ ] `highlightInstance`, `highlightInstances`, and `scrollToInstance`
        reject as for a missing instance.
  - [ ] `startPick` rejects at once without `onPickStart`.
  - [ ] Each marker reports `unavailable`.
- [ ] Export `MoklyPhoneFrame` and `MoklyBrowserFrame` over `PhoneFrame` and
      `BrowserFrame`, without the viewport label, under Decision 7.
  - [ ] Each frame takes `colorScheme` for its screen surface and status band,
        and the selected scheme is the default.
  - [ ] The browser frame takes `address`. Its bar copies the address and
        expands the frame.
  - [ ] Inside slot content, each frame keeps its styles as a part scope.
- [ ] Node tests: the context for every entry kind, a variant, a removed
      record, and each viewport, scheme, and mode. Test `undefined` and `null`,
      no frame or comparison markup with a host stage, and both frame parts.
- [ ] Browser specs:
  - [ ] A host stage makes no frame, comparison, or preview request.
  - [ ] A mode switch and a selection change call `stage` with the new context.
  - [ ] Markers report `unavailable`, and the handle methods reject.
  - [ ] A host browser frame copies its address and expands.
- [ ] Smoke test: an embedded host with a host stage in Chrome.

## Milestone 6: Static Rendering And Link Addresses

Tags: ui

Make static rendering a supported behaviour under Decisions 2 and 3.

- [ ] In a static render, call `detail` during the render for the route's
      detail requests. Give each validated object to the store's initial
      details. The browser keeps the call after mount.
- [ ] Add one link function to the shell context. An embedded root resolves each
      catalogue link at its artifact origin root. The standalone shell keeps
      root-absolute links.
- [ ] Use the link function at every link: the brand, the not-found view,
      navigation rows, breadcrumbs, details rows, the variant bar, usage links,
      evidence links, the Props link, and flow step links.
- [ ] Remove the reads of browser globals, time, and random values from render
      paths.
- [ ] Apply the failure rules of review 1 finding 4: a throw from `detail`
      reaches the host, a detail that fails its fences shows the failure state
      without Try again, and no event callback fires.
- [ ] Split `embeddedMarkup` in `packages/viewer/tests/presentation_v7_helpers.tsx`
      into two named helpers. One renders the browser's first render with
      pending details. The other renders a static render with object details.
      Move each assertion of the four test files that use it to the helper
      whose premise it checks.
- [ ] Node tests in a new `packages/viewer/tests/static_render.test.tsx`.
      Render `MoklyViewer` and every part with `renderToStaticMarkup` from the
      protocol fixtures, for every entry kind, with and without a host stage.
  - [ ] A host stage with object details shows no loading copy.
  - [ ] Every `href` and `src` is a full HTTP(S) address or a same-document
        fragment.
  - [ ] The overlay and `emptyState` are not hidden.
  - [ ] Two renders give the same HTML.
  - [ ] A throw from `detail`, a failed fence, and a URL result each give
        their stated result, and no event callback fires.
- [ ] Browser tests: an unmodified click on a full-address link still proposes
      the selection, and a modified click opens the address. Update the
      embedded tests that expect root-absolute links.

## Milestone 7: Static Render Conformance

Prove on every gate run that Mokly accepts a static viewer in its own screens.
Prove in the release that the published archive renders statically.

- [ ] Read the `rust` skill. Add a CLI integration test under
      `crates/mokly-cli/tests/` with a fixture catalogue of two React screens.
  - [ ] The first screen renders `MoklyViewer` from the protocol fixtures with
        host slots, a host stage in `MoklyPhoneFrame` and `MoklyBrowserFrame`
        parts, and the scoped stylesheet.
  - [ ] The second screen renders a custom layout of the parts.
  - [ ] `mokly build --strict` must succeed. The document URL policy, the
        reserved names, and the imported stylesheet rules then accept the HTML.
  - [ ] The repository suite runs the test on every pull request, release pull
        requests included.
- [ ] Add one static render check under `scripts/` that the release consumer
      smoke under `scripts/release/` and `npm run package:smoke` both call. It
      renders `MoklyViewer` and every part with `react-dom/server` from the
      installed archive. It fails on loading copy or on a root-absolute
      address.
- [ ] Run `npm run package:smoke`, so that the new check runs before merge.

## Milestone 8: Package README And API Docs

- [ ] Extend `tests/markdown_links.test.ts` to every Markdown file under
      `packages/`, and fix each broken link that it then finds. Update the
      sentence in `AGENTS.md` that names the scope of the check.
- [ ] `packages/viewer/README.md`: the static rendering promise, a link to the
      examples page, and the part entry points under its Key Code section.
      Remove "renders only in the browser". The README has 285 lines, so keep
      it at or below 300.
- [ ] Add the examples page as `packages/viewer/docs/{topic}/README.md`, like
      the other package pages. It holds a stage slot example and a custom
      layout example.
- [ ] Split `packages/viewer/src/shell/README.md` by area before it grows. It
      has 515 lines.
- [ ] The shell README describes the entry provider, the part files, and the
      static render rule.
- [ ] `packages/viewer/docs/api/README.md`: the flat host content props and
      `stage`, `MoklyViewerRoot`,
      each part with its props and placement, `ViewerStageContext`, and the
      stability promise.
- [ ] `packages/viewer/docs/concepts/README.md`: host stages, custom layouts,
      static rendering, and link addresses.
- [ ] Search `docs/`, `plans/`, and every `README.md` for
      `EmbeddedStageOverlay`, for the words "in the browser", and for each
      other removed or renamed name. Update the live references.

## Milestone 9: Release And Upgrade Notes

The change ships in the next minor release of the shared version: 0.17.0, when
no other release comes first. Release Please proposes it from the breaking
`feat` commit, because `bump-minor-pre-major` keeps a pre-1.0 breaking change
on the minor stream.

- [ ] Add a "Viewer Stage And Parts Release Note" to
      `docs/protocol/npm-release-notes.md`. It lists the new exports,
      the flat host content props and `stage`, static rendering, and the
      upgrade steps for hosts. It names the removed `ViewerSlots` type in its
      own code span, as the export ratchet requires.
- [ ] The note names the behaviour changes: full link addresses in embedded
      roots, the overlay inside the stage with its remount, and `emptyState`
      inside `main`.
- [ ] Use this squash title:
      `feat(viewer)!: add a stage slot and export the shell parts`.
- [ ] Add a `BREAKING CHANGE:` footer that names the link and overlay changes.
      Write placeholders as `{name}`, with no angle brackets.
- [ ] Remove the status lines that this plan added, when each page's behaviour
      is in place.

## Milestone 10: Verification, Commit, Review, And Pull Request

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings, then
      apply the review-fix rule: fix the `Auto-fix: yes` findings, re-review
      once, and report the rest.
  - Two reviews of the plan ran on 2026-10-27. Review 1 fixed its findings 1
    and 7 to 11, and review 2 fixed its findings 2, 3, 5, 6, and 7. The
    reports are `review-1.md` and `review-2.md` in
    `.context/viewer-stage-slot-and-parts/`. The Decisions section records the
    items that the user answered. These items stay open for the user.
  - Review 1 finding 12: The plan does not hold work for the decisions.
    Severity Low, effort Small. Recommended: A, Milestone 1 starts after the
    answers.
  - Review 2 finding 4: No step opens a static render. Severity Low, effort
    Small. Recommended: A, open both conformance screens in Chrome in
    Milestone 7.
  - Follow-up: run `design_adoption.spec.ts` in the mockup check of
    `AGENTS.md`. Effort Small. Covers review 2 finding 2. Previous examples:
    review 1 finding 10.
  - `docs/protocol/mokly-viewer.md`: a route change does not discard the
    inspector tab, which the root store keeps. Separate branch.
- [ ] Open the pull request when every other milestone TODO is ticked. Put its
      link in the status paragraph.

## How Mokly Cloud Uses The Result

The 24 mockups under `docs/mockups/src/entries/product/viewer`:

- Each React mockup renders `MoklyViewer` in place of the `renderViewer` HTML.
  Mokly's sidecar renders it with `renderToStaticMarkup`, which this change
  supports.
- The mockup passes the fixture index object, a `baseUrl` at the sample
  catalogue origin, and a `detail` function that returns fixture detail
  objects. It passes the cloud controls as host content props, such as
  `topBarEnd`, and adds `stage`.
- For a ready publication, `stage` returns a sample screen inside
  `MoklyPhoneFrame` and `MoklyBrowserFrame` parts. For an empty, loading,
  error, build, or access
  state, it returns one cloud card.
- Both HTML patches go. The links are full addresses at `baseUrl`, and the
  overlay is visible.

The app:

- `MoklyViewer` keeps working after the move from `slots` to flat props.
  `MoklyViewerRoot` and the parts serve a layout that those props cannot give.
- The cloud cards that replace the package today can sit in `stage`,
  inside the real viewer chrome.
- Viewer links become full catalogue addresses under Decision 2. A modified
  click opens the catalogue's own page. A private catalogue cannot load there
  until the out-of-scope host transports exist.
- Mokly Cloud bumps both pins to the release in one commit, as its Decision 6
  says.

## Open Questions

1. Should a static render start in a comparison mode or with the inspector open
   on a tab? Neither is public state today, so a mockup cannot show them.
2. Should the frame parts also include the component canvas and the document
   pane?
3. Should viewer links point at host routes? That is option C of Decision 2, a
   later change.
4. Should `ViewerStageContext` carry the effective scheme after the Light-only
   fallback?
5. Should the root entry carry a `"use client"` directive for hosts that use
   React Server Components?

## Post-merge Follow-up (non-blocking)

- [ ] Merge the Release Please pull request of the release. Confirm that the
      release smoke renders the published viewer statically.
- [ ] Give Mokly Cloud the released version for its pin bump.
