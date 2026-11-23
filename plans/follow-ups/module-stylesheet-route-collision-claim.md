# False claim that stylesheet route forms never collide

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from the branch
  `conductor/storybook-support-d-vite-adapter`.
- **Location:** `docs/protocol/mokly-imported-styles.md:34` to line 36,
  `crates/mokly-css/src/compiler.rs:37` and `:58`,
  `crates/mokly-graph/src/styles.rs:66`,
  `crates/mokly-graph/src/graph.rs:135`, and
  `crates/mokly-graph/src/route_inventory.rs:17` and `:42`.
- **Reason:** Each fix changes a route rule of a protocol page, which needs
  the user, and the false sentence predates the Vite adapter work.

- **Source:** Implementation.
- **Category:** Docs or spec.
- **Terms:**
  - **Delivery root:** a source whose CSS Mokly bundles into one generated
    stylesheet. It is a configured or component-declared local stylesheet,
    the renderer module, or an entry module or stories file that reaches CSS.
  - **Module root:** a delivery root that is a JavaScript module, such as the
    entry module `src/a.tsx`.
  - **Local stylesheet root:** a delivery root that is a configured or
    component-declared local stylesheet, such as `design/base.css`.
  - **Stylesheet route:** the path of a generated stylesheet inside the
    `static/mokly-generated/` namespace of a build, such as
    `styles/design/base.css`.
  - **Vite adapter:** the optional compile path that the `vite` field of
    `mokly.config.json` turns on. It sends JavaScript and stylesheets through
    the project's own Vite setup.
- **Background:**
  - The section "Routes And Ownership" of
    `docs/protocol/mokly-imported-styles.md` gives two route forms. A module
    root delivers at `styles/{module path}.css`. A local stylesheet root
    delivers at `styles/{stylesheet path}`.
  - Lines 34 to 36 of that page then say: "`src/home.mockup.tsx` delivers
    `styles/src/home.mockup.tsx.css`, and the configured `design/base.css`
    delivers `styles/design/base.css`; the two forms never collide because a
    module path never ends in `.css`."
  - `prepare` in `crates/mokly-css/src/compiler.rs:58` builds each route from
    `styles/`, the root path, and a suffix. Without the adapter, `bundle` at
    `compiler.rs:37` gives a module root the suffix `.css`. It gives a local
    stylesheet root an empty suffix.
  - Under the adapter, `bundle` in `crates/mokly-css/src/vite.rs` gives a
    module root the suffix `.css`. It gives a local stylesheet root an empty
    suffix when its path ends in `.css`, and the suffix `.css` otherwise.
  - `roots` in `crates/mokly-graph/src/styles.rs:66` keys the delivery roots
    by their paths. So `src/a.tsx` and `src/a.tsx.css` are two roots.
  - `crates/mokly-graph/src/graph.rs:135` registers the route of each root in
    one `RouteInventory`. `RouteInventory::insert` in
    `crates/mokly-graph/src/route_inventory.rs:17` fails when a second root
    has the same route after ASCII lowercase folding.
  - For a route under `styles/`, `collision` at `route_inventory.rs:42` gives
    this failure text:
    `stylesheet route collision: {route}; rename one of the files whose stylesheets share this route`.
    `docs/protocol/mokly-imported-styles-errors.md` catalogues this text as
    the row "Two roots at one route", with the code `build-invalid`.
  - Lines 41 to 44 of `docs/protocol/mokly-imported-styles.md` already state
    one collision under the adapter. The configured stylesheets
    `design/base.scss` and `design/base.scss.css` share one route, and the
    pair fails with the route collision diagnostic.
  - The test "Vite reports a configured Sass and CSS route collision" in
    `tests/vite_stylesheets.test.ts` checks that pair. No test covers a module
    root and a local stylesheet root at one route.
  - Each option keeps two rules of `docs/protocol/mokly-imported-styles.md`.
    Mokly delivers every delivery root. Each stylesheet route ends in `.css`,
    because a static host chooses the MIME type from the file extension.
- **Problem:** The sentence on lines 34 to 36 is false, with and without the
  adapter. The entry module `src/a.tsx` delivers its CSS at
  `styles/src/a.tsx.css`. A configured or declared stylesheet `src/a.tsx.css`
  delivers at the same route, so the build fails with the route collision
  diagnostic.
- **Impact if no action:** Readers trust a guarantee that the code does not
  give. A later change that relies on it, such as a route check that skips
  module roots, could deliver one stylesheet in place of another. A user who
  meets the collision gets a diagnostic that the page says cannot happen.
- **Root question:** What does the delivery contract promise when a module
  root and a local stylesheet root map to one stylesheet route?
- **Options:**
  - **A.** Fix the sentence. Say that the two forms can give one route, as for
    `src/a.tsx` and `src/a.tsx.css`. Say that such a pair fails with the
    route collision diagnostic. The code and the behaviour do not change.
    Effort: Small.
  - **B.** Fix the sentence as in A. Also make the route collision text name
    both roots, such as `src/a.tsx` and `src/a.tsx.css`, so that the author
    sees which files to rename. The graph then keeps the root path of each
    route. The exact text of a catalogued row and the tests that match it
    change. Effort: Small.
  - **C.** Change the route rule, so that no local stylesheet root can give
    the route of a module root. For example, deliver each module root bundle
    under its own first segment beside `styles` and `assets`. This changes
    the published route of every module root bundle and the artifact path
    contract in `docs/protocol/mokly-artifact-paths.md`. More than 20 test
    and fixture files assert such routes, and the cloud contract fixtures
    need `cargo xtask mokly-fixtures`. A new reserved first segment also
    rejects each entry whose first folder has that name. Effort: Medium.
- **Left out:**
  - Change nothing. The page keeps a false guarantee, so this fails the goal.
  - Let one root keep the route and drop the other. A document then links
    the wrong CSS, which is wrong output.
  - A configuration check that rejects a local stylesheet path such as
    `src/a.tsx.css`. Configuration cannot know whether `src/a.tsx` reaches
    CSS, so the check would reject catalogues without a collision.
- **Wider fix:** None. This is docs drift, and its wider fix, the
  `documentation` skill, is already in force. C makes the sentence true
  through a code change, but it is not a wider fix for docs drift.
- **Previous examples:** Commit `4c8cbe72` stated a similar collision under
  the adapter, the `.scss` and `.scss.css` pair, in the same section. The
  false sentence came with commit `d935e6a6`, which rebuilt the backend as a
  Rust core.
- **Recommendation:** A. The code already fails such a pair with a catalogued
  diagnostic, so a true sentence closes the gap without a behaviour change. C
  best protects the codebase, because no such pair can then exist, but it
  moves every module root bundle for a rare file name.
- **Action:** ask the user, because A changes the route rule "the two forms
  never collide" of `docs/protocol/mokly-imported-styles.md`, and no recorded
  user decision says whether the page or the code is right.
