# Re-review how Mokly names delivered stylesheets and assets

- **Severity:** High. **Effort:** Small. **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-28, from the Storybook support plan, track E decision 1,
  which the user answered with option F "for now".
- **Location:** `crates/mokly-css/src/paths.rs:20-40`,
  `crates/mokly-graph/src/imported_assets.rs:29`,
  `crates/mkc-mokly-contract/src/paths.rs:82-86`,
  `docs/protocol/mokly-imported-styles.md` section "Routes And Ownership",
  `docs/protocol/mokly-imported-styles-assets.md:62`, and
  `docs/protocol/mokly-moves.md:76-82`.
- **Reason:** The user chose F on 2026-11-28 to unblock track E, and asked
  for a high-priority re-review of the whole route strategy, because the route
  form gets harder to change once Mokly Cloud stores many publications.

- **Terms:**
  - **Route:** the path under `static/mokly-generated/` at which Serve, a
    static build, and Mokly Cloud deliver a bundled stylesheet or an asset.
  - **Portable segment rule:** each route segment starts with a letter or a
    digit, and a stylesheet segment can also start with `_` or `-`. No
    trailing dot, no Windows device name, no space, and no non-ASCII letter.
  - **Path hash:** a short digest of the file's repository-relative path. It
    stays the same while the file keeps its path.
  - **Content hash:** a short digest of the file's bytes. It changes on every
    edit.
- **Background:**
  - Today a route copies the source path: `src/home.mockup.tsx` delivers
    `styles/src/home.mockup.tsx.css`, and `src/images/logo.svg` delivers
    `assets/src/images/logo.svg`.
  - The route is the identity of a file for three jobs. Changes compares
    resource references by route, accepted moves map routes by their source
    directories, and Serve and the caches key files by route.
  - Mokly Cloud treats each path segment that starts with a dot as private,
    and GitHub Pages skips paths that start with `.` or `_`.
  - Track E decision 1, answer F: each segment that starts with a dot is
    written in a form that starts with a letter, such as `dot-storybook` for
    `.storybook`, in every generated route. No route that worked before
    changes. Mokly's own `node_modules/.mokly-roots/` segment becomes
    `dot-mokly-roots`.
  - Storybook and Vite write flat names with a content hash, such as
    `assets/preview-3f9a1c.css`. Their main reason is caching: a changed file
    gets a new URL, so hosts can cache each file forever.
  - Mokly does not need hashes against stale copies. Serve sends
    `Cache-Control: no-store` (`docs/protocol/mokly-runtime.md:134`). A
    static build is served with `no-cache` revalidation
    (`docs/protocol/mokly-export-delivery.md:92`). Mokly Cloud serves ordinary
    assets with `no-cache` and a SHA-256 `ETag`
    (`docs/protocol/cloud/catalogue-delivery.md:39-41`). A comparison
    generation already has a content-addressed folder.
- **Problem:** Answer F keeps source paths in routes. A file whose name has a
  space, a non-ASCII letter, or a Windows device name still fails the build,
  and a real `dot-storybook` folder beside `.storybook` collides. Every page
  load also sends one revalidation request for each stylesheet and asset.
- **Impact if no action:** The route form stays a protocol and Mokly Cloud
  contract. Each later change of it changes every published URL, the contract
  fixtures, and the Changes, move, and cache rules at once.
- **Root question:** Which route form should Mokly use for delivered
  stylesheets and assets in the long term, so that every source file name
  works on every host, and Changes, moves, and caches keep a stable identity
  for each file?
- **Options:**
  - **A.** Keep answer F: source-path routes, with leading dots written as
    `dot-`. No route that works today changes. Rejected names still fail.
    Effort: Small, because track E builds F.
  - **B.** Flat names with a path hash, such as
    `styles/preview.tsx-3f9a1c7b.css` and `assets/logo-9c0d1e2f.svg`. Every
    file name works, and routes stay stable for Changes and the caches. Every
    route changes, a route no longer shows the source folder, warnings need a
    map back to the source path, and moves must map through stored source
    paths. It changes the route rules of about six protocol pages, the Rust
    route code, its tests, and the Mokly Cloud contract fixtures. Effort:
    Large.
  - **C.** Flat names with a content hash, as Vite does. Hosts can then cache
    every file forever. Each edit changes the route, so Changes sees a
    removed and an added file, moves lose their route map, and Serve must
    rewrite every document that links an edited file. Each of these needs a
    new mechanism. Effort: Large.
  - **D.** Keep source-path routes, and escape every segment that the portable
    rule rejects, such as dots, spaces, and non-ASCII letters, in one
    reversible form. Every file name works, names get hard to read, and a few
    routes that work today change. Effort: Large.
  - **E.** Do A or B, and add a content-hash query string to each reference,
    such as `?v=3f9a1c`, for immutable caching. The route keeps its identity,
    but Changes compares references with their query, so each edit changes
    the reference in every linking document. Effort: Medium.
- **Left out:** A rewrite of routes at publish time, because publish uploads
  the output of `build`, and Serve and the static build would then use other
  routes than Mokly Cloud.
- **Wider fix:** B, because it removes every rejected-name failure and keeps
  a stable identity for each file.
- **Previous examples:** The `.mokly-roots` segment that Mokly Cloud rejects,
  which track E records in `plans/follow-ups/mokly-roots-route-is-private-in-cloud.md`
  on its branch.
- **Recommendation:** A, until a user reports a file name that the portable
  rule rejects, or until Mokly Cloud needs immutable asset caching. B is then
  the next step, and C is not worth its new mechanisms while revalidation
  keeps every copy current.
- **Action:** ask the user, because every option except A changes the route
  contract that Mokly Cloud and every published catalogue use, and the user
  asked for this re-review.
