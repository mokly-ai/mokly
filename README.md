# Mokly

Mokly turns React-authored mobile and desktop mockups into static
HTML, exports complete catalogues for hosting, serves them during development, and compares screens
with their Git baseline on demand. It is app-independent: product screens, component libraries,
themes, styles, and compatibility adapters stay in the consuming repository.

The public [npm package](https://www.npmjs.com/package/@mokly/mokly) is
`@mokly/mokly`; its executable remains `mokly`. Releases remain pre-1.0 while
the consumer contract settles.

Shared components can have their own pages, saved variants and editable props in
local Serve. Screens record their actual component usage for inspection and
highlighting. Component implementation edits appear once in Changes; consumers
are listed as affected, while changes to their supplied props remain screen
changes. See the [component authoring guide](./src/components/README.md).

Screen-only catalogues also show stylesheet evidence in Details before opening
a comparison: changed styles that may apply and examined stylesheets whose
changes do not apply. Opening a comparison preserves those details and adds its
retained evidence. See [CSS change attribution](./docs/protocol/mokly-css-attribution.md).

## Use Mokly

Install Mokly and its React peers in the repository that owns the screens:

```bash
npm install --save-dev @mokly/mokly react react-dom
```

Create `mokly.config.ts`:

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  repoRoot: ".",
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
  renderer: "docs/mockups/renderer.tsx",
  stylesheets: [{ match: "app/**/*.html", stylesheets: ["app.css"] }],
  review: {
    base: "origin/main",
    outDir: ".context/mokly-review",
    sharedImpact: ["src/components/**", "src/tokens/**"],
  },
});
```

Use `review.sharedImpact` as fallback impact evidence for files the rendered
resource graph cannot see, such as source components or token modules. Linked
stylesheets and their imports are attributed by rule automatically: a view keeps
the dependency only when a changed rule could match or cannot be resolved.
Unmatched rules are examined and excluded; a broad stylesheet glob cannot
override that exclusion or add unreferenced public files to Changes.
This configuration uses the default `generatedOutput: "committed"`. Commit the
generated HTML and manifest alongside their source. Check verifies that generated
bytes match the current compilation; comparisons read their baseline from Git
without executing historical code. [Derived output](#derived-output) is an
optional mode for repositories that want to keep generated files out of Git.

An entry module ends in `.mockup.ts` or `.mockup.tsx` and exports `mockups`:

```tsx
import { defineCollection, defineScreen, MockLink } from "@mokly/mokly";

export const mockups = [
  defineCollection({
    id: "account",
    title: "Account",
    description: "Account product screens.",
    childIds: ["account-home"],
    relatedDocs: ["docs/account.md"],
    dependencies: ["src/account"],
  }),
  defineScreen({
    id: "account-home",
    title: "Account home",
    description: "The account landing screen.",
    route: "account/home.html",
    mobile: (
      <MockLink fragment="summary" to="account-detail">
        Details
      </MockLink>
    ),
    desktop: (
      <MockLink fragment="summary" to="account-detail">
        Details
      </MockLink>
    ),
    relatedDocs: ["docs/account.md"],
    dependencies: ["src/account/home.tsx"],
    useCaseIds: [],
  }),
];
```

`mobile` and `desktop` accept any React node; real screens usually wrap their
content in a `<main>` landmark because each fragment is generated as its own
standalone page. Collection membership is also the navigation hierarchy:
Mokly infers the screen's `Account` breadcrumb from `childIds`, so authors
do not maintain a separate breadcrumb path.

`MockLink` accepts a lowercase kebab-case entry id and an optional bare HTML id
through its separate `fragment` prop. The equivalent string helper is
`mockLink(id, fragment?)`; both produce `mock:<id>[#fragment]`. Raw complete
logical values remain available for an HTML/SVG link `href`, while
`data-nav-href="mock:<id>[#fragment]"` records metadata without inventing an
interaction. Generated files retain portable relative links, so standalone and
comparison snapshots continue to work. In Browse, an eligible link opens the
destination's canonical catalogue page, carries its fragment, and reveals the
active item in the navigation tree. Untyped JavaScript calls are validated at
runtime as well: ids and fragments must be strings before their respective
grammars are applied.

```tsx
import { mockLink } from "@mokly/mokly";

const detailsHref = mockLink("account-detail", "summary");
// "mock:account-detail#summary"
```

To use a styled control as a catalogue link, opt into `MockLink asChild`:

```tsx
<MockLink asChild to="account-detail">
  <button className="primary-action">View account</button>
</MockLink>
```

Mokly adapts that one rendered control into a native link during the build,
preserving its classes, inline styles, label, and icons. Custom components may
render an HTML `a`, `button`, `div`, or `span`; put attributes on the child,
which must have no interactive descendants. Disabled or busy controls remain
inactive, and adapted links receive a visible keyboard focus outline. The
default `MockLink` behavior and documents without child links keep their bytes.
Navigation works in Browse, use-case frames, standalone files, and Review
snapshots through the existing link mechanism, without a consumer click script.

Keep any props your component requires to render enabled; Mokly handles the
destination through the generated link. Native browser button chrome and
JavaScript-driven hover/pressed effects are not reproduced by static adaptation.
See the [styled link controls contract](./docs/protocol/mokly-link-controls.md)
for supported markup, inactive states, and validation rules.

Color-scheme adoption has two steps: enable `colorSchemes: ["light", "dark"]`
in the config, then select the consumer theme from `input.colorScheme` in the
configured renderer. Mokly re-renders the same mobile and desktop nodes for
dark output; authors do not duplicate screen trees. A deliberately light-only
screen opts out in either `defineScreen` or a nested `screen` marker:

```tsx
defineScreen({
  // Other screen fields stay unchanged.
  colorSchemes: ["light"],
});
```

Light-only catalogues omit `colorSchemes`, keep their existing renderer, and
produce the same fragment names and manifest bytes as before.

After installing, run the local CLI with npx:

```bash
npx mokly                         # browse immediately, render on demand, and watch
npx mokly serve --no-watch --port 0
npx mokly serve --debug-timings
npx mokly build
npx mokly check
npx mokly export --out .context/mokly-site
```

Options follow the command, so an explicit config is
`npx mokly build --config path/to/mokly.config.ts`. With a local
development dependency, `npx --no-install mokly` guarantees npm does not
fall back to the registry. A clean machine may use
`npx --package @mokly/mokly mokly` without adding a dependency. The unscoped
name is not a package alias; imports also use `@mokly/mokly`.

Value options also accept `--name=value`, which supports values beginning with
`-`, such as `--config=-catalogue.config.ts`. Empty values and assignments to
boolean flags are rejected.

| Command                     | Outcome                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `mokly`                     | Browse on demand and watch using a stable development URL    |
| `mokly serve`               | Serve the catalogue and on-demand diffs; watch by default    |
| `mokly build`               | Validate and transactionally write generated output          |
| `mokly check`               | Validate committed bytes or require untracked derived output |
| `mokly export --out <path>` | Build a complete static catalogue for your host              |
| `mokly publish`             | Export and upload a catalogue to your chosen service         |
| `mokly --help`              | Show commands and their supported options                    |
| `mokly --version`           | Print the installed package version                          |

Serve starts at port `4173`. If that port, or a concrete `--port` value, is
already occupied, Mokly tries each following port in order until one is
free. `--port 0` instead asks the operating system to choose a free port.
Watched Serve keeps the first resolved port for later child restarts so its URL
stays stable. When controls are active, every Serve request requires Host to be
`localhost:<port>` or `127.0.0.1:<port>` with a decimal port from 1 to 65535 and
no leading zero. Forwarding through another local port is supported; a
non-loopback Host returns 403 for the whole catalogue. Render POST still requires
the exact matching HTTP Origin and render token. See the
[controls contract](./docs/protocol/mokly-component-controls.md).

For slow startup, add `--debug-timings` to any command. It writes structured
phase timings and aggregate catalogue sizes to stderr while leaving normal
output and generated files unchanged. It separates bundling, rendering,
validation, file writes, watcher setup, child readiness, and background Changes.
Review timings distinguish Git baseline and document reads, comparison loops,
resource traversal, CSS rule analysis, and artifact writes. Build and Check do not run review.
Parent timings include child phases; overlapping timings must not be added
together. See the [diagnostic contract](./docs/protocol/mokly-timings.md).

To investigate scale locally, first run `npm run fixture:large`. This explicitly
prepares a synthetic 1,410-route catalogue with 5,550 documents and an isolated Git
baseline. Then run `npm run dev:large -- --debug-timings` or
`npm run benchmark:large`; neither repeats setup. The browser benchmark requires
searchable navigation and a real preview within five seconds for both a fresh
process and a warm restart, exercises Props, themes, viewports and pages, and
waits for Changes separately. Use matching `--areas 2 --screens 10 --rows 6`
options for smaller setup and benchmark runs. Fixtures stay under `.context`.
The default fixture also has four shared stylesheets linked by half its screens
and an unrelated stylesheet-rule edit after the Git baseline. Configure that
workload with matching `--stylesheets` and `--stylesheet-share` options on setup
and benchmark commands.
Pass `--derived` to fixture setup and benchmark for a separately recorded
source-only baseline with its own packaged Mokly and dependency lockfile.
The benchmark requires a cold rebuild and a warm cache hit, reporting baseline
preparation separately while keeping the five-second navigation target for both.
See the [large fixture guide](./tests/fixtures/large/README.md).

Serve validates a lightweight catalogue index and makes navigation and local Props
controls available without rendering every document. A worker renders and validates
each requested preview, caching it for the current source generation. Props edits
render only the selected variant and view. An unrelated renderer failure does not
prevent valid previews from opening. Catalogue-wide Usage is explicitly unavailable
until the background check finishes; it is not shown as zero consumers.

Full generated output and Git-based Changes finish in the background, with preview
and Props work taking priority between background documents. Build, Check and Export
remain exhaustive. Replacing or stopping background work cancels and drains its Git
subprocesses before terminating the worker, including when that worker is unresponsive.
All and Changes are visible from the first live shell. Changes shows a spinner
instead of an uncomputed count; selecting it shows a loading sidebar without
moving the tabs or tree. A failed check keeps the tabs with an explicit unavailable
state, while a completed empty result shows zero. Versioned updates publish complete
usage and then Changes. Shell requests never repeat that repository work.

These background updates preserve the mounted page, previews, search, folder
choices, focus, scroll and temporary props, including when All is selected.
Authored content changes still reload; reconnects catch up to the latest evidence
without replaying navigation recovery. See [live evidence updates](./docs/protocol/mokly-live-evidence.md).

Baseline views are read in batches, not one Git process per view. Watched Serve also observes
Git ref changes off the request path. `--no-watch` uses the same fast startup but
does not observe later source, resource or Git edits. Unavailable history omits
change evidence while current previews remain accessible. See [on-demand Serve](./docs/protocol/mokly-on-demand.md).

`build` writes one fragment per effective viewport and color-scheme view plus
`mokly-manifest.json` under `mockupsDir`. `check` calculates those bytes
without writing. Committed mode reports missing, stale, or orphan generated
files; derived mode reports tracked generated or cache paths. The
manifest stays internal: its source inventory is unavailable through HTTP,
published assets, and comparison resources. Ordinary public JSON remains
supported. Browse
serves the package-owned Mokly shell — resizable desktop catalogue
navigation with separate collapsible Pages and Components sections, folder and
entry-kind icons, and an All/Changes filter, search that
narrows the tree by page ID, title, route, and `tag:` terms that the field's tag
picker and the details inspector's chips enter for you, hierarchy-derived
breadcrumbs with hash-prefixed copyable ID chips, realistic browser chrome with
an expand-to-overlay toggle, phone chrome whose screen reserves a clock,
signal, Wi-Fi, and battery status band above the mobile fragment, header
viewport controls, a Light/Dark switch when the catalogue has dark fragments,
use-case flows, a collapsed-by-default details inspector that remembers its
disclosure across routes and reloads, id redirects, and watched updates. The
Changes filter compares
an explicit projection of route-level manifest metadata, collection ancestry,
generated fragments, and their rendered local resources with the branch
point shared by `HEAD` and the configured Git base. Collection ancestry comes
from real `childIds` relationships; compatibility-only `navPath` labels are
excluded. Commits added only to the base branch after divergence do not appear
as branch changes; staged, unstaged, and untracked workspace edits still do.
A source or dependency edit does not add screens whose output and reviewable
metadata remain unchanged. Source locations and dependency declarations are
evidence, so reorganizing them alone does not fill Changes. Generated fragments
use the comparison engine's paired ignore rules: excluded chrome-only edits
stay out, while material keys and changes to screen content remain reviewable.
Linked stylesheet edits mark a view only when a changed rule could apply or
cannot be resolved. Formatting-only or unrelated rules are recorded as examined
and excluded. Fonts, images, and other transitive resources retain file-level
impact; unrelated public files do not mark the whole catalogue.
For public file and directory aliases, edits to the target also mark consuming
screens and pages, even when the alias itself is unchanged.
The filter validates referenced public files, including changed stylesheets and
their imports. Invalid resources make Changes unavailable until repaired;
verified deletions still identify affected screens, while All remains accessible.
Serve automatically watches those referenced local resources, including nested
CSS imports, and refreshes its watch set when their references change.
Lightweight watched updates immediately clear stale Changes evidence and notify
the browser without restarting the server child. A sequence-checked background
classification publishes a later update with the complete replacement snapshot;
failed or superseded calculations cannot restore stale rows.
Served `/static/` files use `Cache-Control: no-store`, so a watched reload reads
the rebuilt fragments and resources even when their URLs remain unchanged.
Changed screens and changed or removed saved component variants offer
Current / Side by side / Overlay / Difference beneath the heading. The controls
are available from All and Changes, and start in Current. Known unchanged views
show Unmodified without a comparison band; unknown evidence has no status badge.
During development, Mokly generates comparison snapshots only after a diff
option is selected; browsing, filtering, and watched reloads do not trigger
generation. Opening a diff reuses completed background evidence and captures only
the selected screen or saved variant and its referenced assets, without rebuilding
or snapshotting the entire catalogue. Checked-input fingerprints prevent later
output edits from silently changing a comparison. See the
[selected comparison contract](./docs/protocol/mokly-selected-comparisons.md).
Changing viewport, theme or comparison mode renews the loaded snapshots before
using them. After an idle comparison expires, Mokly automatically reacquires
the same screen or saved variant. Available snapshots reuse their loaded result;
published catalogues need no renewal requests.
Published catalogues with Changes enabled prepare snapshots during publishing, then load
and render them only after a diff option is selected. Comparisons
stay in the same screen, with mobile/desktop and light/dark controls, secondary
impact evidence, and a refresh option. Loading and failure states keep the
catalogue available and offer a retry. Navigation and reload return to Current.
Added entries show their current preview and Added status without comparison
controls because there is no earlier version to compare. Removed screens show
their Removed status and an explicit current empty state without comparison
controls; removed component variants retain an explicit missing current side.
Affected consumers can show their real before/after differences without entering Changes. Comparison,
shared-impact, and declared-dependency evidence stays in the Details inspector.
A changed stylesheet adds a secondary list there naming the changed styles that
apply to the screen, or saying the change can apply anywhere on it. A stylesheet
whose changed styles reach nothing on the screen is listed as examined and
excluded instead, and never produces a Changes row. A screen kept only by a
stylesheet edit reads "Styles this screen uses changed" above its comparison.
Selector text stays inside that secondary list. See the
[CSS change attribution contract](./docs/protocol/mokly-css-attribution.md).
Evidence remains available independently of comparison controls. Links and
incoming comparison URLs are checked against the selected saved view, so a
current-only Added or Removed screen cannot activate a hidden comparison;
Removed component variants can still open their retained baseline.

The comparison engine retains the Git branch-point baseline, ignored-region
rules, and isolated snapshot dependencies. Its private diagnostic summary counts
screens with output changes separately from dependency evidence and ignored-only
edits. Each count includes a screen once across all viewports and color schemes;
these screen counts differ from the catalogue's screen, page, and flow count.
Overlays use 50% opacity; Difference
uses CSS blending, without inventing pixel measurements. Immutable generations
keep snapshots coherent during refresh, retain replaced resources briefly, and
drain generation work before shutdown. The former Review tab, standalone report,
`mokly review` command, and its report-output option have been removed.
`--out` is supported by the separate `export` and `publish` commands.

Consumer documents run in sandboxed frames. Comparisons keep unmodified base/head
documents in separate snapshot trees and copies their referenced local CSS,
fonts, and images so comparison artifacts do not depend on the live workspace.
Served comparison snapshots reject symbolic links at the file, ancestor-directory,
and retained-root boundaries, and serve only regular files.
Filesystem-backed Browse and comparison routes reject malformed encoding,
traversal segments, absolute paths, and forward or backslash separators
introduced by decoding one original URL segment before resolving a consumer
file.
Base resources must use portable relative URLs or explicit HTTP(S)/data URLs;
root-absolute, protocol-relative, and unsupported-scheme URLs fail comparison.
Browse authenticates catalogue-link metadata only on current manifest-owned
generated fragments and whole-document pages. It reads only each shell-owned frame's
immediate same-origin document, while scripts, forms, downloads, popups, and
top navigation remain unavailable to consumer content and nested frames.
Copied base resources must be regular Git files outside configured source roots.
Inside a fragment, use `MockLink` for catalogue destinations; root-absolute and
logical screen routes are not portable links in generated static files. Build
and check rewrite and validate every supported `href` and `data-nav-href`, plus
local HTML resource attributes and transitive CSS URLs. Watched Serve keeps its
resolved port, transactionally reloads a changed consumer config with a ready
replacement watcher, and serially replaces a child that exits unexpectedly
after readiness. A watched child also closes its server when the parent IPC
channel disconnects. Header-proven generated output plus package-owned
dependency, build, test, comparison, and transaction paths are pruned even when a
custom rule watches the repository root; an unowned public HTML file can still
use an explicit watch rule, and configured stylesheets and referenced resources
retain reload precedence. Shutdown interrupts replacement-watcher readiness and
active Git classification, closes the
candidate before draining the remaining lifecycle, and waits for child exit
through graceful, terminate, and force-kill stages. Failed startup, child
transport errors, and unexpected IPC disconnection use the same cleanup;
disconnection is detected immediately even if the child remains alive and no
further update is sent. A replacement waits until the previous process has
stopped. Concurrent shutdown requests share that wait, and late readiness
messages cannot revive a closing child. Startup allows a watched child up to five
minutes to become ready before cleanup begins. Every served catalogue shell
records the update version captured when its request begins. Open shell pages compare that
snapshot with the versioned event stream and reload after a newer build or
asset version arrives, including when the build completes before the initial
stream connection. Publishing a reload-only watch update invalidates the comparison cache; another
explicit diff selection regenerates it. A
watched reload restores Browse search, filter, current and pre-filter collection
disclosures, viewport, drawer, and scroll state once on the same durable URL.
Browse also retains each history entry's latest document position for Back and
Forward. Skip links and same-document fragment history preserve the current view
and native focus without reloading it; route and saved-variant query changes
still restore the matching page. While Changes filtering is active, route changes preserve collections
the user collapsed and open only the destination's ancestor path. Editing the
search or filter reveals its current matches. Clearing all filtering restores
the earlier disclosures, except that a navigated destination's path stays open.
A rejected config, index, or replacement watcher leaves the last-good generation
active. A later background render/write failure preserves the previous generated
output and withholds complete evidence; valid on-demand previews remain usable.

## Configuration

Mokly discovers `mokly.config.ts`, `.mts`, `.js`, or `.mjs` by walking
upward from the current directory. Every filesystem path is relative to that
file and confined to `repoRoot`.
Everything below `mockupsDir` is public unless protected by the
[source policy](./docs/protocol/mokly-source-protection.md), including public exclusions.

Transitive authoring imports must also remain inside that root. Config, entry,
renderer, transformer, and page-helper imports outside it fail with the offending
path instead of creating an incomplete source inventory. Move shared authoring
code inside the root or explicitly configure a common root containing it;
installed dependencies remain supported outside the root.
All bundler file inputs are protected authoring sources, including images or
data imported through asset loaders. Editing them rebuilds the catalogue.
Assets referenced only by public HTML/CSS URLs remain public resources unless
another protection rule or public exclusion applies.

- `entriesDir` and `mockupsDir` select structured source and generated output.
  Prefer sibling `docs/mockups/entries` and `docs/mockups/generated` directories,
  with `docs/mockups/renderer.tsx` beside them. Keep public assets such as `app.css`
  in `generated` and developer README/tsconfig files beside it. Nested
  `docs/mockups/src` layouts remain supported.
- `publicExclude?: readonly string[]` adds safe POSIX globs matched relative to
  `mockupsDir`. Defaults are `**/README`, `**/README.*`, `**/tsconfig.json`, and
  `**/tsconfig.*.json`, all matched case-insensitively.
  Consumer globs extend these defaults; `[]` retains them. See the
  [configuration contract](./docs/protocol/mokly-configuration.md#public-exclusion-configuration).
- `colorSchemes` defaults to `["light"]`; `["light", "dark"]` enables dark
  fragments catalogue-wide, with per-screen light-only opt-outs.
- `renderer` and ordered `stylesheets` keep product themes and CSS
  consumer-owned. A stylesheet rule may append `lightStylesheets` or
  `darkStylesheets` after its shared list for the matching output.
- `moduleResolution` configures package roots, aliases, export conditions,
  package fields, file extensions, and esbuild loaders for cross-platform
  component trees.
- `legacy` configuration has been removed. Register complete documents with
  `definePage` or nested `page`; imported helpers remain protected source inputs.
- `watch` classifies additional consumer inputs after proven package-owned
  ignores, configured stylesheets, and referenced resources; this includes
  unrelated authored static HTML under `mockupsDir`. `review` selects the Git
  base ref used to find the branch point,
  internal snapshot directory, and `review.sharedImpact` fallback globs for files
  the resource graph cannot see. Linked stylesheets are attributed by rule.
- `compatibility.readManifestV2` permits a historical v2 Git baseline only when
  its canonical manifest is absent. Current output always requires v5. A temporary `compatibility.transformer` may deterministically
  repair already-authored documents during a consumer cutover; final links,
  resources, and the comment-safe generated source proof are still validated.

Use `MockLink` for catalogue destinations. Raw relative links remain suitable
for real static assets and complete documents, but logical screen/use-case routes
do not name generated files in schema v5.

### Derived output

Set `generatedOutput: "derived"` to keep generated HTML out of Git, as this
repository's example does.
Build still writes transactionally; Check validates the
compilation and rejects tracked generated files or cache contents, without
requiring local generated files to exist or match. Authored public CSS and HTML
remain allowed in Git. Add ignore rules for your generated routes and manifest,
plus `.mokly-cache/`, and remove any already tracked generated files from the
index with `git rm --cached`.
The index check also recognizes ownership headers on generated pages that were
renamed or removed from the current catalogue, even without local copies.

Derived comparisons rebuild the merge-base commit in an isolated extraction,
using that commit's dependencies and Mokly version, then cache its output.
This executes historical code: use a trusted mainline as the base. The default
commands are `npm ci` followed by
`npx --no-install mokly build --config <repository-relative-config-path>`.
Override the exact ordered argv list when your project needs additional steps:

```ts
export default defineConfig({
  generatedOutput: "derived",
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
  renderer: "docs/mockups/renderer.tsx",
  review: {
    baselineBuild: [
      ["npm", "ci"],
      ["npm", "run", "build:tooling"],
      ["npx", "--no-install", "mokly", "build", "--config", "mokly.config.ts"],
    ],
  },
});
```

Commands run from the historical repository root without a shell; no commands
are appended to an explicit list. `baselineBuild` is rejected in committed
mode. See the [derived baseline contract](./docs/protocol/mokly-derived-baselines.md)
and [storage rules](./docs/protocol/mokly-baseline-storage.md) for cache limits,
network configuration, Windows npm/npx launching, and the one-catalogue-per-commit
cache boundary. Ordinary edits keep an active baseline rebuild running; changing
the branch point or build settings replaces it.
Windows builds preserve native npm/npx launchers and use operating-system job
ownership so cancelling a build also stops programs it started, even after its
launcher exits. Keep the package's optional native dependencies installed;
missing process-tree support fails before the historical build starts.
Temporary cache-lock cleanup failures are reported separately without losing
the build's lock ownership.

## Whole-document pages

Use a page for an existing complete HTML document without inventing device
variants. Add its ID to the owning collection's `childIds`:

```tsx
import { definePage } from "@mokly/mokly";
import { source } from "../pages/handbook.source.js";

export const mockups = [
  definePage({
    id: "handbook",
    title: "Handbook",
    description: "Product reference notes.",
    route: "handbook.html",
    dependencies: ["docs/mockups/src/pages/handbook.source.tsx"],
    relatedDocs: [],
    tags: ["documents"],
    render: source,
  }),
];
```

The synchronous callback runs once and returns one complete HTML document at
the exact route. Pages share IDs, ancestry, links, tags, Changes, source guards,
and safe output transactions with screens. Page titles and collection membership
do not rewrite explicit routes. Nested `page({ slug, ... })` definitions derive
routes from `defineRoot.path`, collection segments, and their slug.

This is a breaking upgrade: current output requires manifest v5, and legacy
configuration, discovery, comment expansion, aliases, and lint settings are
removed. The [migration guide](./docs/protocol/mokly-page-migration.md)
explains source-preserving registration and safe regeneration of old artifacts.
Source folders and route folders never create additional navigation groups.
Historical v2/v3 documents pair with registered pages only at exact preserved
routes, using the same material-content, paired-ignore, and resource rules.
New IDs and collection metadata can still put migrated pages in Changes;
unmatched historical documents never become removed catalogue entries.

## Rendering Boundary

The default renderer produces neutral static HTML. A consumer renderer can wrap
the React node in its theme/context and return a complete document. Accounting,
for example, will keep React Native Web style collection in that adapter rather
than making React Native Web a Mokly dependency.

Entries, the renderer, and imported document helpers are bundled into one
build-time graph. React and React DOM resolve from the consumer config location,
which prevents duplicate React instances even when the executable came from an
npx cache. See [the build pipeline](./docs/architecture/build-pipeline.md) for
the complete raw-React-to-static-HTML flow.

The configuration module itself is also bundled from its own directory, so
imports of consumer workspace packages resolve before the temporary config
module is evaluated.

Consumer module-resolution overrides are explicit and contain no React Native
or app defaults. `packageRoots` must identify in-repository directories with a
`package.json`; Mokly searches their `node_modules` directories while still
forcing React peers to the consumer's one runtime.

## Troubleshooting

- **Node crashes in `cjs_lexer::Parse`:** upgrade to a patched Node LTS release.
  Node 24.14.1 has an [upstream native-loader crash](https://github.com/nodejs/node/issues/63323)
  that can surface during worker startup/shutdown. Node 24.21.0 includes the fix;
  this is separate from a Mokly render or validation error.
- **No config found:** run from the consumer repository or pass `--config`
  after the command.
- **A generated file is stale:** run `mokly build`, inspect the diff, then
  rerun `mokly check`.
- **Mokly refuses an overwrite:** the existing HTML lacks a valid Mokly
  ownership header. Current headers encode their source identity so every valid
  repository filename remains safe inside an HTML comment. Move an unowned file
  or choose a non-colliding route; the tool will not delete authored output.
- **A package or React peer cannot resolve:** install React/React DOM in the
  consumer and configure the correct `moduleResolution.packageRoots` for a
  nested npm workspace.
- **A link fails validation:** use `MockLink` for an entry id and a relative URL
  for a real generated/static file. Root-absolute and source-tree links are not
  portable.
- **A watched edit fails:** fix the reported candidate build/config error. The
  last-good server remains active and adopts the next valid change.
- **Export cannot find its baseline:** fetch the configured base with enough
  Git history. Committed mode needs its manifest/fragments in Git; derived mode
  needs a working historical install/build recipe. Export never fetches history
  and does not silently omit comparisons.
- **Export refuses its destination:** choose a missing/empty directory outside
  source, generated, dependency, and comparison roots. Keep unrelated files out
  of owned exports. For a retained reservation, confirm no export is running,
  inspect its stage/backup, and recover the previous site before moving an
  abandoned reservation. Never delete a live writer's reservation.

## Developer Setup

The repository requires Node.js 22.14 or newer, npm 11, and Rust 1.95 for its
repository tasks.

```bash
npm ci
npm run build
npm run example:build
npm test
npm run test:browser
npm run example:check
cargo xtask check
```

The example's generated HTML and manifest are ignored local artifacts; its
authored CSS remains tracked. Both test entrypoints build the package and example
before loading tests, including direct-from-disk design checks. `example:check`
validates compilation and rejects tracked generated output even when the local
files are absent. Example baselines run `npm ci`, `npm run build`, then
`npm run example:build` in the historical extraction.

JavaScript and TypeScript imports stay at the top, grouped as Node builtins,
external packages, package self-imports, parent imports, then sibling/index imports.
Paths are alphabetical within each group, with every parent depth before siblings
and blank lines between groups.
The package's own `@mokly/mokly` public entrypoint is always a repository module,
including before `dist/` has been built. `npm run lint -- --fix` applies the
`import/first` and `import/order` rules, provided by the ESLint 10-compatible
`eslint-plugin-import-x` package.

For local development after installing dependencies, run:

```bash
npm run dev
```

This builds the local CLI and starts the example catalogue with watching enabled.
Open the printed URL, starting at `http://127.0.0.1:4173`. Edits to example
entries, the renderer, and configured stylesheets update the catalogue
automatically; generated HTML is written to `examples/basic/generated/`.
Use `npm run dev -- --port 0` to let the operating system choose a free port.
Restart the command after changing Mokly's own `src/` files; the CLI is rebuilt on every start.

`npm run test:browser` drives the catalogue shell and on-demand screen comparisons
in Chromium via Playwright. Comparison tests await the real generation response
before asserting the rendered UI. Static preview fixtures use ephemeral
inspector ports to isolate concurrent workspaces. The suite uses the installed
Chrome channel by default and honors `PLAYWRIGHT_CHANNEL` for an alternative
browser install. Parallel
workspaces can set `MOKLY_PLAYWRIGHT_PORT` to an available port.
After activating an in-frame design link, assert the outer catalogue URL before
using the destination's controls. Frame-link enhancement updates the outer shell
asynchronously; the click alone can return while the previous frame is visible.
Before checking controls or visibility inside a newly navigated preview, use
`expectFrameLoaded` from `tests/browser/workspace_actions.ts` to wait for the
target frame URL and completed document together. The outer URL and active
navigation row can update before the frame's stylesheets finish loading;
`expectFrameSource` alone checks navigation, not rendering readiness. Keep
strict visibility and control assertions after the readiness check.
Real Git-backed comparison fixtures wait for completed Changes classification.
The shared browser example also waits for terminal Changes in global setup
before tests begin, so comparison and navigation assertions start with complete
evidence. Loading-state and continuity tests own explicit pending fixtures to
exercise evidence completion during browsing and editing.
Run the full browser suite separately from other top-level
checks: publication fixtures rebuild shared package and example output.
Watched tests that assert a stable update version also wait for final Changes
status before capturing their baseline; Usage completion alone can precede
another background publication.
Comparison tests await their final JSON response before applying UI assertion
deadlines. Cold snapshot generation has a bounded
30-second wait tied to the newly triggered request, refresh intent, and its
redirect chain; stale/background responses cannot satisfy it. The existing UI
assertions retain their default deadlines.
Snapshot-link tests await the selected frame's load and native navigation events
before checking destination content; a parsed link alone does not mean its
resources have finished loading. CI uses the Playwright-installed Chromium, and
retains browser traces and error context when verification fails.
Pages preview setup timeouts belong in the setup hook, so build time is
separate from browser assertions.
Resource-watch tests that replace a file in multiple steps use
`waitForChangedCount` to wait for the expected Changes count. A newer version
alone may describe the temporary removal; the helper keeps a bounded wait for
recovery and reports the last published state if it times out.

`cargo xtask check` is the authoritative local gate. It starts with a live
dependency audit (`npm run dependencies:check`), then checks commit titles in
`origin/main..HEAD` against the 50-character limit and includes formatting,
lint, typechecking, unit/integration tests, the derived example, package
allowlist and license checks, clean packed ESM/NodeNext/npx/Accounting/Juno
consumers, Chromium tests, and all Rust checks. It also audits the freshly
resolved packed consumer's production dependencies. Registry access is required;
known advisories or registry errors fail verification. See the
[dependency security contract](./docs/protocol/dependency-security.md).
`npm test` limits test-file parallelism to two workers to keep subprocess-heavy
fixtures within their existing startup deadlines on shared developer machines.
All tests still run, including their explicit concurrent-writer and race cases.
Watcher tests use `tests/helpers/watched_catalogue.ts` to await a newer version
and the expected Changes state within the existing deadline. Multi-operation
edits can publish intermediate states; the first newer version alone does not
prove that an entire replacement or repair has completed.
Process-lifecycle tests use `tests/helpers/process_state.ts` for inspection and
cleanup. A helper disappearing before `ps` runs is a successful exit, not a test
failure. Only the defined empty no-match result and `ESRCH` during cleanup are
accepted; running helpers and other command or permission failures still fail.

## Export And Publish A Consumer Build

From the consumer repository, run:

```bash
npx mokly export --out .context/mokly-site
# For a config under tools/, write tools/site/ and select another Git base:
npx mokly export --config tools/mokly.config.ts --out site --base main
```

Export builds first, then packages the complete catalogue, real id aliases,
assets, and Git comparisons. `--out` is required and config-relative, not
working-directory-relative; absolute paths must remain inside `repoRoot`.
`--base` overrides `review.base` (default `origin/main`). The Git branch point
must contain the required authored assets and either committed generated output
or the source and tooling needed by the derived baseline recipe; CI should
check out full history. Normal build validation, including nonempty registry
requirements, still applies.

Configured package roots nested inside `mockupsDir` are excluded from both
current assets and comparison snapshots. A package root equal to `mockupsDir`
is rejected; use a separate public output directory. Local navigation links
must also target existing document anchors.

Deploy the directory's contents with your own hosting provider. `export` never
uploads files. Serve it at the HTTP(S) origin
root with correct MIME types and directory indexes; no Mokly process, Git,
source tree, or rewrite rules are needed there. Subpath hosting and `file://`
catalogue browsing are unsupported. Configure shell and mutable-asset revalidation and comparison
`Cache-Control: no-store` / `X-Content-Type-Options: nosniff` headers, and deploy
atomically to avoid mixed builds. External HTTP(S) resources stay external, so
not every catalogue is offline-capable.

Comparisons load only after selection. Refresh reads the same exported
generation; deploy a new export and reload the page for new results. Re-export
replaces only owned output and restores the previous site on pre-install
failure when recovery is safe. If another process recreates the destination,
both it and the captured backup are preserved for manual recovery. Generated
fragments already written by the build step remain updated
if the later export fails. See the [export contract](./docs/protocol/mokly-export.md)
and [hosting contract](./docs/protocol/mokly-export-delivery.md).

Output must retain the directory identity inspected before the build. Even an
empty or correctly marked directory created later is left untouched. Capture,
installation, and recovery use OS-enforced exclusive moves on Linux, macOS,
and Windows. Keep optional platform dependencies installed for the native
bridge; unsupported platforms or filesystems fail without a replacing fallback.

Each complete export has its own content-derived deployment identity, separate
from comparison generations. Navigation from an old tab performs a full reload
when the deployed catalogue, assets, or host aliases change, even if the
comparison files are unchanged. Within one deployment, navigation remains
progressive. Hosting must revalidate mutable files so that reload can fetch them.

Concurrent exports to filesystem aliases of the same destination share one
reservation. The internal `.mokly-export-reservations` directory retains
small ownership metadata after cleanup; keep authored files out of it. Old
hashed reservations require explicit recovery after confirming no writer is
active. Unlisted files inside an exported site remain eligible for configured
watch rules and prevent replacement until moved elsewhere.

Backup cleanup deletes only validated files. Unexpected additions stop cleanup
and remain available for recovery; the newly installed site stays in place.
Errors report both the original failure and any cleanup failure, including the
remaining paths. A partially cleaned backup may no longer contain every old
generated file. See the [recovery contract](./docs/protocol/mokly-export-recovery.md).

`npm test` runs at most two suites concurrently so Git-heavy watcher and
publication scenarios remain responsive alongside other development work.
Long resource-watch scenarios allow three minutes for their complete sequence;
production child-startup and individual watched-update deadlines stay separate.

### Upload To A Catalogue Service

`publish` runs the export and uploads one versioned gzip tarball to the exact
endpoint you provide. The same command works with Mokly Cloud or a self-hosted
receiver implementing the [upload v1 protocol](./docs/protocol/mokly-upload.md).

```bash
# Set MOKLY_ENDPOINT and MOKLY_TOKEN in your shell or CI secrets first.
npx mokly publish
npx mokly publish --config tools/mokly.config.ts --out site --base main
npx mokly publish --no-changes --repository git.example.com/team/project
```

`--endpoint <url>` and `--token <token>` override those environment variables;
prefer the token environment variable to avoid shell history. `--out` defaults
to `.context/mokly-publish` beside the config. Comparisons are included unless
`--no-changes` is given; that option needs no baseline history and cannot be
combined with `--base`. Derived catalogues also skip the historical rebuild in
this mode. Publish still requires a committed Git checkout for
revision metadata. Git remote `origin` (or the sole remote) supplies repository
identity; `--repository <host>/<owner>/<name>` overrides it.

For a token beginning with `-`, use `--token=-TOKEN` or `MOKLY_TOKEN`.

The output includes an owned `mokly-upload.json` containing repository, revision
and pinned comparison metadata. Upload failure leaves that local export intact.
The CLI exits nonzero with typed errors, does not follow redirects or retry, and
never prints the token. The upload contract defines receiver validation, limits
and exact rejection categories. Protocol files are included in the npm package.
The [ownership v1 schema and fixtures](./docs/protocol/mokly-export-ownership.md)
define the required file inventory for independent receivers.

Use the [public composite GitHub Action](./.github/actions/publish/README.md)
with an exact released Mokly package version. Check out the consumer, install
its dependencies, and fetch comparison history before invoking it.

## Preview Deployments

`npm run preview:build` exports the current `examples/basic` catalogue to
`.context/mokly-preview`, including navigation, search, tags, metadata,
viewport/color choices, ID redirects, resources, and whole-document pages.
It works without Git history. Both publication options omit live updates,
watch-only modules, events endpoints, and stale comparison artifacts.
Both options share the consumer exporter's output transaction, artifact validation,
and static delivery metadata. They use one validated catalogue snapshot for navigation, captured pages,
and redirects. Input fingerprints retain the exact manifest bytes used by the
snapshot and are checked again after capture; a change aborts publication and
keeps the previous artifact.
Output stays beneath `.context`, whose resolved location must remain inside the
real repository root. In-repository symlinks are supported; escaping context,
parent, or output symlinks are rejected before any publication writes.
Input capture hashes link text without reading outside or unresolved targets.
Safe public file and directory aliases are exported as regular files at their
logical routes; source and internal-metadata aliases remain private. The builder
requires every current page and screen fragment and checks exported resource
references before replacing the previous artifact.

To include Changes, removed-entry states, and frozen screen comparisons:

```bash
npm run preview:build -- --include-changes
npm run preview:build -- --include-changes --base origin/main
```

The base defaults to `config.review.base`. The builder pins one merge base for
impact and comparisons and rejects inputs changing during capture. Visitors
load immutable packaged comparisons only after selecting a diff; refresh reads
the same result. Pages participate in Changes but have no visual comparisons.
Invalid options, unavailable requested history, and capture failures preserve
the previous owned artifact. See the [publication contract](./docs/protocol/mokly-publication.md).
The repository builder and its artifact are not part of the npm package.

The preview adapter's extensionless URLs must not collide with another file,
directory, or alias, including case-only differences. A collision stops export
before replacing the previous site; choose distinct routes or public-file names.
Preview output must remain below `.context` in both lexical and resolved paths.
A symlinked scratch root is supported within the repository's safe boundaries,
but an inner symlink cannot redirect output elsewhere. The same checks run before
generation and before installation, and the resolved destination is pinned.

The Preview workflow keeps deploying `main` to the existing Cloudflare Pages
project `mokabook` at `https://mokabook.pages.dev`. The infrastructure name is
retained so the package migration does not interrupt previews. Same-repository,
non-release pull requests use
the stable `pr-<number>` branch alias at
`https://pr-<number>.mokabook.pages.dev`; a sticky `<!-- mokly-preview -->`
comment reports the deployment status and link. Preview checkouts retain full
Git history so `origin/main` and route-level changes can be resolved. Closing a
pull request marks that comment inactive and attempts to remove its
deployments. Fork pull requests do not receive Cloudflare credentials, and
Release Please pull requests are skipped because their source changes were
already previewed.

Maintainers must create the direct-upload Pages project with `main` as its
production branch, then configure repository variable `CLOUDFLARE_ACCOUNT_ID`
and repository secret `CLOUDFLARE_PAGES_API_TOKEN` (or
`CLOUDFLARE_API_TOKEN`). The token needs Pages write access for deploy and
cleanup operations.

```bash
npx --no-install wrangler pages project create mokabook --production-branch main
```

## Releasing

Changes use Conventional Commits. On `main`, release-please maintains the
reviewed version/changelog PR; merging that PR creates an immutable `vX.Y.Z`
release. The same [Release workflow](./.github/workflows/release.yml) checks the
tag, reruns the full gate, packs and smoke-tests the exact tarball, guards an
already-published version, and publishes through npm trusted publishing. A
bounded post-publish check tolerates npm metadata, tarball, dist-tag, and
signature propagation before proving the registry artifact. A manual
`publish_ref` retries only an existing tag. See the
[release protocol](./docs/protocol/npm-release.md) for the current release/retry
procedure and maintainer settings. Package versions are release-managed.

The one-time [Mokly registry bootstrap](./docs/protocol/npm-bootstrap.md) is
complete: `@mokly/mokly@0.8.0` is the accepted initial `latest` release and also
retains the `bootstrap` tag. Do not repeat registration or reset release state.
Later reviewed releases advance `latest`; `bootstrap` remains on `0.8.0`. The
bootstrap record retains the isolated-build procedure and reviewed source SHA.
Before the first automated release, complete and verify the GitHub release
token's repository access and the
[GitHub publishing protections](./docs/protocol/npm-github-protections.md)
with an authorized maintainer account. The interactive bootstrap does not prove
OIDC publishing works. Do not add an npm write token to GitHub.

The synthetic fixture at [`examples/basic`](./examples/basic/README.md) proves
custom rendering, stylesheets, id links, collections, use cases, and
Review-ignore markers without importing an application. Its screens use
`@firna/ui` through a react-native-web renderer adapter, so the example also
proves the consumer contract against a real cross-platform component stack.
Its `Design` catalogue holds the approved catalogue and Changes mockups
recorded by the
[shell design contract](./docs/protocol/mokly-shell-design.md).
The [component design catalogue](./docs/protocol/mokly-component-design.md)
provides the canonical mobile and desktop inventory for component pages, screen
inspection, a collapsible icon inspector, and the complete prop-controls states.
The [controls designs](./docs/protocol/mokly-component-controls-design.md) show
saved variants and temporary edits, implemented by the local rendering service. The catalogue hierarchy reaches each design without
adding navigation footers to the artboards. The [workspace designs](./docs/protocol/mokly-component-workspace-design.md) add working viewport/theme/highlight controls, a fixed shell with a resizable inspector, entry change-status badges, and comparison evidence inside Details. Unmodified examples and ordinary Browse/tag-picker designs omit comparison tabs;
eligible comparisons retain an opaque toolbar. The desktop grip sits on its
divider line.

All 68 design screens reuse the 15 registered components in
**Components → Design → Shared components**, including the footer tabs panel. The library
provides 56 saved variants, local prop controls, real usage and component-owned
change attribution. See the [shared design library guide](./examples/basic/entries/design/library/README.md).

The design mockups use `MockLink` for supported navigation and state transitions;
the two example buttons demonstrate `MockLink asChild`. See the
[design mockup links contract](./docs/protocol/mokly-design-links.md) for
canonical destinations and the controls that remain visual depictions.

### Key Code

- [`src/index.ts`](./src/index.ts) — supported public authoring API.
- [`src/config`](./src/config) — config discovery, loading, and confinement.
- [`src/publish`](./src/publish/README.md) — upload manifests, archive limits,
  Git identity and the injectable HTTP boundary.
- [`src/build`](./src/build) — single-graph bundling, compilation, links, check,
  and transactional writes.
- [`src/server`](./src/server) — manifest-backed HTTP, the responsive shell,
  and the watched child lifecycle.
- [`src/client`](./src/client) — progressive Browse navigation and versioned
  live updates served to the browser.
- [`src/navigation`](./src/navigation) and [`src/browse`](./src/browse) — shared
  logical-target grammar and ownership-aware HTML adaptation.
- [`src/review`](./src/review/README.md) — Git extraction, comparison, ignore
  normalization, isolated snapshots, and CSS rule attribution shared by Changes.
- [`src/build/source_inventory.ts`](./src/build/source_inventory.ts) — resolved
  authoring inputs; [`src/config/public_files.ts`](./src/config/public_files.ts)
  applies the shared source and internal-metadata policy to public resources.
- [`src/server/catalogue_snapshot.ts`](./src/server/catalogue_snapshot.ts) —
  one validated generation for serving and publication; HTTP dispatch lives in
  [`src/server/http_routes.ts`](./src/server/http_routes.ts).
- [`src/components`](./src/components) — public component definitions, schemas,
  captured input ownership, and manifest-v5 validation.
- [`examples/basic/entries/design/library`](./examples/basic/entries/design/library/README.md)
  — shared components used by the design catalogue itself.
- [`xtask`](./xtask/README.md) — full repository verification.

### Related Docs

The [registered components contract](./docs/protocol/mokly-components.md)
links to the [change attribution](./docs/protocol/mokly-component-changes.md),
[pages and inspection](./docs/protocol/mokly-component-explorer.md), and
[local prop controls](./docs/protocol/mokly-component-controls.md) contracts.
Registration, saved fragments, validated props, change attribution, inspector
pages, and local editable controls are implemented. Static exports retain saved
variants, comparisons and read-only inspection. Development plans are indexed
in the [plans index](./plans/README.md).

- [Protocol index](./docs/protocol/README.md)
- [Package ownership boundary](./docs/architecture/package-boundary.md)
- [Accounting migration inventory](./docs/migration/accounting-framework-inventory.md)
- [Styled control migration guide](./docs/migration/accounting-link-controls.md)
- [Implementation review prompt](./docs/implementation-review-prompt.md)
- [Implementation plans](./plans/README.md)
- [Unified catalogue pages](./docs/protocol/mokly-pages.md) and
  [required breaking upgrade](./docs/protocol/mokly-page-migration.md)
- [Authoring source protection](./docs/protocol/mokly-source-protection.md) and
  [catalogue change metadata](./docs/protocol/mokly-catalogue-changes.md)
- [Versioned Accounting page migration](./docs/migration/accounting-page-entries.md)
