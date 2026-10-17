# Rust Rebuild

Status: Active. Created 2026-10-12 with the user's consent. It supersedes the
native engine plan, which the documentation reset of 2026-10-14 deleted with
every other plan; the branch history before commit `d4bac78d` keeps it.
On 2026-10-12 the user decided to freeze the TypeScript backend immediately,
to remove the replaced JavaScript and its tests together instead of
incrementally, to treat the old outputs as guidance rather than an exact
parity target, to keep counting format versions instead of resetting to v1, to
provide no backward compatibility with old output, to reset Mokly Cloud, and to
keep the upload exchange protocol unchanged. The user also decided that
everything needed for the new version lands in this one plan and one pull
request, and overrode, for this pull request only, the plan rules that bind
one plan to one pull request and that require a functioning product after
every milestone: the branch has no CLI between Milestone 2 and Milestone 6.
Milestone 1 is complete: the Rust core architecture, the sidecar, HTML
screens, HTML components, and comparison contracts exist, the format
inventory names review v8, read model v7 and snapshot v4, and
every protocol page is classified. The structural test that binds the
catalogue page's format table to the old code was deleted on 2026-10-14 with
the other protocol-content tests. On 2026-10-12 the branch was rebased onto the
`AGENTS.md` that names the shared skills, and the rebuild procedures moved
from the removed `docs/dev` directory to
[the protocol page](../docs/protocol/rust-rebuild-procedures.md). Later that day
the user withdrew the committed generated tree: both comparison sides render
from sources, the static output is a plain output, and the Milestone 1 contracts were
revised to match (Decisions 11 to 13). The protocol index then moved eight
generated-tree and baseline pages to retired and the CSS attribution and
Markdown documents pages to rewritten; it lists 72 kept, 75 rewritten, and 21
retired pages beside the five new contracts. On 2026-10-13 the user chose the
two verbs `serve` and `build`, caches outside the repository, the enclosing
scope state in render requests, the sidecar's `describe` call, and frozen
wording for the last retired-page targets (Decisions 14 to 16), then the
definition handle and component entries for Storybook stories (Decisions 17
and 18), and one variant model for every kind (Decision 19), which added the
entry props contract as the sixth new page. Later that day the user adopted a
strict profile of JSON Schema 2020-12 for every prop schema (Decision 20), and
the component prop schema page moved from kept to rewritten. Later on
2026-10-13 the user chose a client-rendered shell with the catalogue index and
entry detail split (Decision 21), which added the shell delivery contract as
the seventh new page, retired the viewer SSR, shell bootstrap, and hydration
coverage pages, and moved the catalogue fetch, embeddable viewer, static export
delivery, and viewer appearance pages from kept to rewritten; the index lists
66 kept, 78 rewritten, and 24 retired pages. On 2026-10-13 the user then
settled the prop schema details, made `argTypes` control hints, unified the
screen and component template language, required one definition per export,
and added `renderPage` (Decisions 22 to 26); the five frozen pages that stated
the old variant rules carry pointers. On 2026-10-14 the user simplified the
shell's update model to one revision, document keys, and a per-process Serve
deployment id (Decision 27), which settled findings 1 to 6 of the shell
delivery review.
Later on 2026-10-14 the user reset the documentation (Decisions 28 and 29):
protocol pages define the end state only, the 24 pages that described the
previous backend alone are deleted, every status section and history pointer
is gone, the 78 pages that described it in part are rewritten now, no test
asserts protocol content, and every other plan is deleted. The previous protocol is `main` commit `0bbd737e`. The same day
the 78 pages were rewritten by subject, the kept pages were swept for retired
wording, the `dependencies` entry field went under Decision 5, and the index
lists 151 pages by subject. Later on 2026-10-14 the user settled the eleven
open shell delivery findings: document keys in the index, the live descriptor
for every catalogue, the deployment id in each event message, and no usage
route (Decision 30).
On 2026-10-14 the user settled the remaining review items of the end-state
rewrite as Decisions 31 to 38.

**Goal:** rebuild Mokly's backend as a Rust core with a Node sidecar for
JavaScript rendering, on a clean tree. The core meets five requirements:
detect changes and affected screens from rendered output and CSS rules, as
today; render screens and components from HTML with YAML front matter without
JavaScript; render every view in memory from the sources of either commit,
with no generated tree;
render components, screens, and stories from JavaScript, React, and Storybook;
and work well with catalogues of thousands of screens. The viewer package stays
and reads the new formats.

**Problem:** in under three months the backend reached 53,000 lines of
TypeScript, 173,000 lines of tests, 169 protocol documents, and 62 plans. Most
of that weight comes from doing the work in JavaScript: string materials, text
offsets, memory tricks, worker and IPC layers, an FFI bridge, and the residue
of six manifest versions and two output modes. Measured on the large fixture
on 2026-10-05, React rendering took 54 to 67 percent of every compile, and the
comparison phase ran out of memory in both Serve and Export. The raw spans and
phase table are under `.context/native-rust-engine/measurements-2026-10-05.md`.
Carrying that code into a Rust engine and a new HTML rendering model costs
more than re-deriving the behaviour from the requirements.

**Decisions (user, 2026-10-12):**

1. Freeze the TypeScript backend now. No new product behaviour lands in `src/`
   or its contracts. Bug fixes Mokly Cloud needs before the switch are the
   only exception, released as patch versions from the `ts-backend-final` tag.
2. Remove the replaced JavaScript and its tests together, in one teardown
   change, after tagging the last commit and capturing reference outputs.
3. Parity with the old backend is guidance only. The reference outputs and
   the old contracts are a checklist for cases the new spec missed or left
   undefined, not an oracle. Differences are triaged as improvement, spec gap,
   or regression, and the decision is written into the spec.
4. Formats keep counting: review result v8, public read model v7, change
   snapshot v4; no generated manifest exists (Decision 11). Every reader accepts exactly one number and
   rejects others with an actionable error. Numbers bump freely before 1.0,
   with no reader for the earlier number. Package 1.0.0 is the first stable
   format promise.
5. No backward compatibility with old output: no reader, shim, or migration
   for old manifests, caches, baselines, config shapes, or authoring modules.
   A base commit renders from its sources, so Changes works across the
   switch; a base whose sources fail current validation makes Changes
   unavailable with those diagnostics (Decision 11).
6. Mokly Cloud is reset and republished; its viewer and receiver update in the
   same window as the first release of the new core.
7. The upload exchange (plan, blob, complete; v1) and its validation rules do
   not change. They carry bytes and digests and never interpret the catalogue.
8. The first release of the new core is a 0.x minor version with a
   breaking-change release note.
9. HTML screens and components carry their front matter in a leading `---`
   block with the same delimiter rule as Markdown documents. No comment form
   is accepted, so there is one way to write it. Mokly's own attributes keep
   their short names, `mokly-viewport` and `mokly-instance`; strict HTML
   validity is not a goal of the format.
10. The sidecar bundles consumer JavaScript and reports the module graph;
    Rust owns invalidation and caching. Milestone 1 chooses between esbuild
    and Rolldown for that bundling and records why.
11. No committed generated tree (2026-10-12). Both sides of a comparison
    render from sources: the head from the working tree, the base from the
    base commit's Git tree, through one render graph and a bounded render
    cache; both sides use the current Mokly version. No command writes into
    the repository. The static output of `build` is a plain output that
    nothing reads back, and `publish` uploads it. This withdraws the earlier requirement to keep
    tracked and rebuilt output.
12. React and Storybook components, React screens, the renderer module, and
    consumer PostCSS at the base follow three dependency tiers (2026-10-12,
    widened 2026-10-13): an identical lockfile uses the working tree's
    dependencies; a different lockfile installs the base's dependencies into
    a bounded content-addressed cache with lifecycle scripts disabled under a
    time limit; an impossible install uses the working tree's dependencies
    with a warning.
13. Markers (2026-10-12): the core attaches ownership and ignore regions to
    tree nodes; comment markers exist only in the fragments a sidecar
    returns; ignore scopes resolve at render time; the `mokly-` prefix is
    reserved for element names in authored HTML and for comment names in
    fragments. A changed style rule that matches no element produces no
    evidence record. Amended by Decision 31 on 2026-10-14.
14. Two verbs (2026-10-13): `serve` and `build`. `build` validates the
    catalogue, renders every view, fails on errors and, with `--strict`, on
    warnings, and writes the static output into the directory `--out` names,
    `mokly-static/` at the repository root by default, which Git must ignore.
    `publish` builds into its own directory outside the repository and
    uploads. Amended on 2026-10-14 by the end-state rewrite: `serve`, `build`, and `publish` take `--base <ref>`, and `build` and
    `publish` take `--no-changes`; `publish` builds into a private directory
    that the terminal names and keeps after a failed upload. There is no
    `check` and no `export`; a validation-only run is a build to a temporary
    directory. Amended by Decision 36 on 2026-10-14.
15. Caches (2026-10-13): the render cache is process memory. The base-side
    extraction cache and the dependency install cache live outside the
    repository, in the operating system's cache directory under a key derived
    from the repository path, bounded by bytes and evicted least recently
    used; the terminal names the directory, and deleting it is safe. No
    command writes into the repository except `build` into its output
    directory.
16. Scope state (2026-10-13): the core sends the enclosing ignore scope state
    with each component render, the sidecar seeds its React scope context
    from it, the fragment cache key includes it, each slot placeholder reports
    the state at its position, which the core applies as the innermost scope
    of the slot content, and the core applies no outer scope to a fragment.
17. Handles (2026-10-13): `describe` returns every definition with a handle,
    the file path, `#`, and the export name; `renderScreen` and
    `renderComponent` name a definition by its handle and pass the props, and
    the fragment key holds the handle or the story id. Amended the same day
    under Decision 19: a variant is a props set and has no handle of its own.
18. Stories (2026-10-13): a stories file becomes one component entry at the
    path derived from the file, and each story becomes a variant of it with
    its `args` as props; the schema is inferred from the args, and `argTypes`
    enrich the derived controls (Decision 23). The read model and the viewer need no
    story kind.
19. One variant model (2026-10-13): every screen and component is a render
    over props with `propSchema`, `props`, and optional `variants` whose
    props replace top-level keys; the entry's own view renders its props;
    components need no variant and their page shows the own props first; a
    schema that is not declared is inferred from the saved props, and
    non-data values are excluded with a warning; controls derive from the
    schema; `defineScreen` takes `render(props)`; HTML screen and component bodies share one
    template language (Decision 24); read model v7 gives screens the component prop fields.
20. Prop schemas (2026-10-13): every prop schema, declared or inferred, is a
    JSON Schema 2020-12 object schema under the strict profile of the entry
    props contract: `type`, closed `properties` with `required` and
    `additionalProperties: false` (Decision 22), `enum`,
    `const`, `oneOf` of constants, `items` with the array bounds, the string
    and number bounds, `anyOf`, `title`, `description`, and `$schema`;
    `default`, `$ref`, and every other keyword are rejected. One validator on the `jsonschema` crate checks schemas and
    props in Rust; the viewer validates control input with a profile
    validator that generates no code; `json-schema-to-ts` derives the
    authoring types. Inference emits the profile, with a `type` list for
    mixed kinds and no `items` for an array empty in every set.
21. Client-rendered shell (2026-10-13): the Browse shell renders only in the
    browser. Serve and `build` deliver one identical stub page per shell
    route, the catalogue index v7 without per-view usage at
    `mokly-viewer/index.json`, and one entry detail v1 per entry with its
    usage, resource evidence, and workspace lists; Serve adds the live
    descriptor v3 at `mokly-viewer/live.json`. No process renders shell HTML,
    so the sidecar starts only for JavaScript rendering, and `renderShell`,
    the shell bootstrap, the delivery descriptor, hydration, the page-fetching
    route evidence, and the one-shot reload recovery are retired. No update
    reloads the page. `MoklyViewer` takes an index source and a detail
    source, and `renderViewer` goes. The
    [shell delivery contract](../docs/protocol/mokly-shell-delivery.md) owns
    the routes; the example-export measurements behind the decision are in
    `.context/rust-rebuild/shell-delivery-measurements-2026-10-13.md`.
    Amended on 2026-10-14 under Decision 27.
22. Prop schema details (2026-10-13): every object schema, the root included,
    carries `additionalProperties: false`, and a schema without it fails;
    inference reads the entry's own props and every variant's merged props,
    so the entry's own keys are `required` and a key only a variant adds is
    optional, and a `defineScreen` without `propSchema` is generic over its
    `props` literal with `Partial` variant props; a derived number control
    offers only valid values, with `multipleOf` as its step counted from zero
    and 1 for an `integer` without it, and no schema is rejected for the
    step; a derived select labels an option by its `title`, else the string
    itself, else the JSON text of the value.
23. Stories as control hints (2026-10-13, amends 18): the schema of a stories
    file is always inferred from the args; `argTypes` enrich the derived
    controls with options, bounds, step, name, and description, exclude
    non-prop args (`control: false`, `table.disable`, an `action`, a
    `function` type) without a warning, and never enter validation.
24. One template language (2026-10-13, amends 19): screen bodies and
    component bodies share one template language, `$name` references and
    coerced attributes on component elements, `{{name}}` substitution,
    `mokly-if`, and `mokly-viewport`, with slot placeholders in component
    bodies only; a body reads only its own entry's props, an undeclared
    reference fails with `html-props` in either body, and one parser and one
    renderer serve both.
25. One definition per export (2026-10-13): an export contributes exactly
    one definition; an array export fails with `array-export` naming the
    export, because no helper returns an array once a variant is a props set.
26. Pages (2026-10-13): the sidecar's `renderPage` runs a `definePage`
    callback by its handle and returns the complete document, its resources,
    and warnings; the core applies the pages contract's document rules to it.
27. One revision (2026-10-14, amends 21): the index carries one integer
    `revision` that Serve raises by one per publication, in place of the
    update version and the content and evidence revisions; each event stream
    message carries the revision as its id and no data, and a new connection
    receives the current revision at once; every detail view carries a
    `documentKey`, the hash of its rendered bytes, and the shell reloads only
    the frames whose key changed; a current entry's detail repeats the index's
    `deploymentId` and `revision`, while a removed entry's detail inside a
    comparison generation carries the generation and the snapshot id instead,
    so generation files never change; `build` hashes the output with the id
    fields zeroed and Serve keeps one `deploymentId` for the life of the
    process, so a different id always means a full page load; the index
    carries `base` and, in Serve, `live: { generation }`, and the live
    descriptor v3 carries only the render capability; a page's resource
    evidence and the workspace lists have typed shapes in the detail, and the
    catalogue page's v7 types are revised in place. This settles findings 1
    to 6 of the shell delivery review. Amended on 2026-10-14 under Decision 30.
28. Documentation reset (2026-10-14): protocol pages define the intended end
    state. No page describes the previous implementation, a former format, or
    delivery history; a page whose behaviour is not implemented starts with
    `Status: In progress under the Rust rebuild plan`, its only plan
    reference. The 24 pages that described only the previous backend are
    deleted now, the 78 pages that described it in part are rewritten now so
    that the whole specification is reviewed before code lands, the root
    README and the architecture pages follow the same rule, and the guides
    follow at their milestones. The previous protocol is `main` commit
    `0bbd737e`; the `ts-backend-final` tag pins it at the teardown. No test
    asserts protocol page content; the link check and the 250-line cap stay.
29. Plans (2026-10-14): every other plan is deleted, and their open
    follow-ups are void under this reset. `main` commit `0bbd737e` keeps the
    merged plans; the branch history before commit `d4bac78d` keeps the
    native engine plan.
30. Shell delivery settled (2026-10-14, amends 27): `documentKey` lives on
    the index's view, page, and document records, is the document node's
    input hash of the render graph, and exists before a render; the shell
    fetches the live descriptor whenever the index carries `live`, whose
    `generation` is the render generation that fences live prop renders for
    HTML and JavaScript entries alike; each event stream message carries the
    revision as its id and the server's `deploymentId` as its data, and a
    message with another deployment id is a full page load; the live
    descriptor v3 has a typed shape; a view's and a page's `resourceEvidence`
    is the review v8 `rules` and `resources` records with their owners, and
    the comparison contract defines `ResourceEvidence`; the workspace has no
    `status`; Serve sends no cross-origin header on any route; no page states
    server rendering or hydration; the shell delivery page names the
    comparison serving contract as the owner of the comparison routes; and
    per-view usage has no route of its own, so a detail carries `pending`
    until the next publication. This settles the open findings of the shell
    delivery reviews of commits 1fdf5d95, 62223201, and 7cb14ebf. Amended by
    Decision 34 on 2026-10-14.

31. Markers in output (2026-10-14, amends 13): served and built documents
    keep the `mokly-instance` and `mokly-slot` comment markers of every region
    the core composed, whatever rendered the instance, so the published
    inspector resolves `r-n` regions in the live page. Ignore regions resolve
    at composition, and the `mokly-link` marker of a `MockLink asChild`
    control is the fourth reserved marker; both are consumed and never
    written. Canonical form removes every marker before comparison. A
    stylesheet whose changed rules all match nothing on a view produces one
    `excluded` record with an empty selector, owned by the entry.
32. One render signature (2026-10-14): `defineScreen` and `defineComponent`
    take `render(props, context)`, where `context` is
    `{ viewport, colorScheme }` and a render may ignore it.
33. CSS Modules in the core (2026-10-14): the core scopes `*.module.css` on
    `lightningcss` after the consumer's PostCSS step and derives the class map
    with the path-hash naming rule; `bundle` compiles each module CSS import
    to a stub that reads the generation's map table, which the core supplies
    through the sidecar's `cssModules` call after `bundle` reports the graph and
    before `describe` evaluates the modules.
34. Live render fence (2026-10-14, amends 30): the live render request and
    response carry the installed `revision`, and Serve rejects an older
    revision with the stale-revision code; a change of the index's
    `live.generation` refetches the descriptor, replaces the capability, and
    rerenders the current validated props. There is no stale-generation code.
35. Wire literals (2026-10-14): `sourceKind` is always `"base"` and the
    `"generation"` kind does not exist; the instance and slot key domains are
    `mokly-instance-v1` and `mokly-slot-v1`; the move diagnostic reads
    `matched no removed base entry`.
36. CLI, packaging, and read model settlements (2026-10-14, amends 14):
    `serve` also takes `--base <ref>`; `publish` prints
    `Mokly publish build: <directory>` once, before its build; the viewer's
    public entries are the root, `./browser`, `./data`, and `./styles.css`;
    `packages/mokly` holds the `@mokly/mokly` shim, sidecar, and authoring
    API, and `src/` is deleted at the teardown; the `Changes ready` line
    reports the Changes count with the moved and ignored-only counts, zero
    segments omitted; every ready view and page of the entry detail carries
    `resourceEvidence` with both arrays, empty allowed.
37. Data-only configuration (2026-10-14): the configuration is
    `mokly.config.json`, read by the core, with a JSON Schema the package
    ships for editors; `--config` names another JSON file. A `$`-prefixed
    string in a stylesheet list is a token, and `$componentStylesheets` is the
    only token. There is no `defineConfig`, no TypeScript or JavaScript
    configuration, no sidecar at startup, and no configuration import to
    watch.
38. Documentation settlements (2026-10-14): the six duplicate pages
    (generated delivery, catalogue fetch, live capabilities, removed preview
    frames, publication changes, configuration discovery) merge into their
    owners and `verification-protocol-index.md` is deleted; the viewer package
    README, the xtask README, the guides, and `AGENTS.md` follow the end state
    now. The guides wait for the user's decision on the guide tests, recorded
    under the review TODO as item E.

39. Template spacing (2026-10-15): substitution accepts optional ASCII
    whitespace around the prop path inside `{{ }}`. `{{ name }}` equals
    `{{name}}` in text and attributes. The catalogue checker and HTML renderer
    use the same rule.

40. Static output parser (2026-10-15): keep Oxc for the module-request rules
    of `mokly-export-browser.md`. A real parser distinguishes regular
    expressions, division, comments, and decoded import strings. The added
    dependency closure has 32 crates. Licence classes are MIT, MIT/Apache-2.0,
    Unicode-3.0, and Apache-2.0 WITH LLVM-exception OR BSL-1.0 for
    `dragonbox_ecma`. Review Oxc's 0.x API changes with dependency updates.

**Approvals the user gave on 2026-10-12, recorded for the teardown:**

- Deleting content on `origin/main` for the teardown: the paths named in
  Milestone 2. The teardown commit restates them.
- The functioning-product rule is suspended between the teardown and the end
  of Milestone 7, when the viewer reads the served catalogue again, and from
  the end of every milestone that emits a new format until the end of the
  milestone in which the viewer reads it; today that is Milestones 9 to 10.
  The viewer package keeps working throughout.
- Pending the user's approval, under the rule that a new gate needs it: the
  Rust advisory audit, the generated-TypeScript byte-identity check, and the
  time and memory budgets of Milestone 14. Milestone 3 records the answer
  before adding any of them.

**Review decisions the user gave on 2026-10-12:** every live native engine
reference is repointed now; head styles, owned and unowned, leave the canonical
form; the behaviour-table script is written on this branch; the server
milestones serve the new formats and the viewer reads them in the milestone
that follows; `defineComponent` gains `element`; sidecar recycling thresholds
are fixed; the protocol triage stays under `.context/`; the documentation
policy page is kept; the four remaining format owners carry Delivery Status
pointers; the pull request description writes `{target}` for the placeholder.
Later that day the user chose render-time scope resolution with comment
markers only in sidecar fragments, the suspension principle for every
new-format gap, no evidence record for a rule that matches nothing, and the
one-word version repair on the component review page. On 2026-10-13 the user
also chose the sidecar's `describe` call as the source of JavaScript component
definitions and frozen wording for the two remaining retired-page targets, then
widened `describe` to every definition kind and the story inventory, fixed
the `ignoreScope` values as `enabled` and `disabled`, chose the definition
handle for render requests, and made Storybook stories component variants.
The same day the user normalised variants to one model for every kind and
adopted the JSON Schema profile for prop schemas, then settled the profile's
closed objects, inference sets, control step and labels, made `argTypes`
control hints, unified the template language, required one definition per
export, added `renderPage`, and approved pointers on the five frozen pages.
On 2026-10-14 the user settled findings 1 to 6 of the shell delivery review
through Decision 27.

**Architecture:**

- The `mokly` executable is a Rust binary shipped in `@mokly/native-<target>`
  platform packages, resolved by a small Node shim in `@mokly/mokly`. The
  binary owns discovery, the catalogue model, HTML composition, stylesheets,
  document assembly, a content-addressed render graph with parallel scheduling,
  watch, the server, comparison, the static build, and publish. No command
  writes into the repository; `build` writes its output directory.
- A pool of Node sidecars renders only JavaScript: a React component with
  props, a React screen, a Storybook story through portable stories, and a
  `definePage` document. A sidecar returns an HTML fragment plus the styles
  that render produced, or a page's complete document. The binary memoizes
  every fragment by the hash of bundle generation, handle, props, viewport,
  scheme, and enclosing ignore scope; a page by generation and handle.
- The Browse shell renders only in the browser, from the catalogue index and
  one entry detail per entry under the
  [shell delivery contract](../docs/protocol/mokly-shell-delivery.md). Serve
  and `build` deliver one identical stub page per route and never render
  shell HTML.
- Screens and components can be HTML files with YAML front matter. The format
  adopts the decisions of the HTML screens plan on branch
  `calummoore/yaml-vs-html-screens` (front matter keys, custom element names,
  kebab-case attributes coerced through prop schemas, variants, `mock:` links,
  ignore markers, and exact diagnostics) and adds HTML components: a front
  matter block with the element name, prop schema, and slots. Screen and
  component bodies share one template language, `$name` prop references,
  `{{name}}` substitution, `mokly-if`, and `mokly-viewport`, with named slots
  in component bodies. No loops or expressions in the first version.
- Comparison works on trees, not text. Both sides render from sources with
  the current version, the base from its Git tree under the dependency tiers
  of Decision 12. Ownership and ignore regions are node annotations, carried
  as comment markers only in sidecar fragments; an element's owner is its
  nearest enclosing region;
  materiality compares canonical trees after removing ignored regions and
  head styles, owned and unowned; styles count through rule evidence only.
  CSS attribution keeps today's rule-level matching and its
  conservative keep list, on the `lightningcss` and `selectors` crates.
  Inline style ownership for sidecar-rendered components comes from the render
  itself, so no inference is needed; whole-screen React entries get one simple
  rule stated in the spec.
- Every shared shape has one definition in a Rust model crate, and the
  TypeScript types are generated from it. Format bumps are one edit.
- Rust conventions follow the shared `rust` skill that `AGENTS.md` names:
  trait seams, `dyn` dispatch,
  `unimock`, `thiserror`, `tracing`, 300-line files, `_tests_` directories.

**Non-goals of this plan:** changing the viewer's presentation;
compatibility readers; a pure YAML screen format; loops or expressions in HTML
bodies; pixel comparison.

## Order of work

The milestones run in order on one branch. Milestones 1 and 2 remove the old
backend; Milestones 3 to 6 restore a CLI that serves HTML catalogues;
Milestones 7 to 13 add the sidecar, Changes, watch, the static build, publish,
and release packaging; Milestone 14 proves scale; Milestone 15 closes the plan.
Each milestone runs the gap sweep of Milestone 1 for its subsystem before it
closes. Milestones tagged `ui` change only the viewer package.

## Milestone 1: Architecture spec and contracts

Documentation only. At completion the new spec set defines the rebuild
without guesswork, and every protocol page is classified.

- [x] Write `docs/architecture/rust-core.md`: the crate layout, process
      topology (shim, binary, sidecar pool), the build graph and its cache
      keys, the tree-based comparison model, memory bounds, and the format
      inventory with the numbers of Decision 4.
- [x] Write `docs/protocol/mokly-sidecar.md`: the sidecar lifecycle, the
      newline-delimited JSON requests and responses for component, screen,
      story, and shell renders, the style-collection rule, the fragment cache
      key, cancellation, timeouts, and the fail-closed rules.
- [x] Write `docs/protocol/mokly-html-screens.md` and
      `docs/protocol/mokly-html-components.md` from the HTML screens plan's
      decisions and the HTML component format above, each with one worked
      example and exact diagnostics, with the `---` front matter rule of
      Decision 9, and with the file kinds for pages, flows, and use cases
      that need no JavaScript (YAML or HTML files, decided here).
- [x] Decide and record the sidecar bundler (Decision 10), the consumer
      PostCSS worker, the React style-collection rule, and the Storybook
      portable-stories entry.
- [x] Write `docs/protocol/mokly-comparison.md` and revise
      `mokly-css-attribution.md`: tree materiality, marker-derived ownership,
      the inline style rule for whole-screen entries, Changes membership,
      review result v8, and change snapshot v4.
- [x] Revise `mokly-catalogue.md`, `mokly-format-versions.md`,
      `mokly-paths.md`, `mokly-folders.md`, `mokly-variants.md`,
      `mokly-moves.md`, and `mokly-documents.md` to the new numbers and the
      tree model; state that no earlier number is readable.
- [x] Classify every page in `docs/protocol` as keep, rewrite, or delete, with
      one reason each, in `.context/rust-rebuild/protocol-triage.md`; put the
      resulting index in `docs/protocol/README.md`. The upload exchange pages
      and fixtures are keep, unchanged.
- [x] Write the gap-sweep procedure and the reference-capture procedure into
      `docs/dev/rebuild.md`: which scenarios to capture, the behaviour-table
      script, and the triage bins of Decision 3.
- [x] Update `README.md`, `docs/dev/documentation.md`, `AGENTS.md` where they
      assume the TypeScript backend, and add the breaking-change note to
      `docs/protocol/npm-release-notes.md`.
- [x] Validate Prettier, links, protocol sizes, and the documentation tests.
- [x] Commit.

Outcomes recorded in the contracts: the screen suffix is `.screen.html`
(not `.mockup.html`) so HTML screens, components and pages share one naming
rule; pages are `.page.html` and use cases `.use-case.yaml`; the sidecar
bundles with esbuild because the frozen backend's plugin behaviour ports
directly and its metafile is the module inventory, with Rolldown reviewed
after the first release; the bundle generation is the fragment cache key; and
styles are collected per render. The protocol triage is
`.context/rust-rebuild/protocol-triage.md`: 77 pages kept, 81 rewritten by
their owning milestones, 14 retired at the teardown.

## Milestone 2: Reference capture and teardown

At completion the protocol set describes the end state, and the branch holds
the viewer, the authored example content, a trimmed `xtask`, and a green
reduced gate. No CLI exists
until Milestone 6. `main` keeps the old backend until this pull request
merges; the freeze applies to it from 2026-10-12.

- [x] Documentation reset (Decision 28): delete the 24 pages that described
      only the previous backend, strip every status section and history
      pointer from the remaining pages and READMEs, mark the 84 new and
      rewritten pages `In progress`, regroup the protocol index by subject,
      and rewrite the documentation policy and the rebuild procedures.
- [x] Delete the protocol-content tests (`component_protocol_docs`,
      `protocol_structure`, `protocol_split_links`, `protocol_doc_history`,
      `path_protocol_examples`, `design_links_inventory`,
      `design_screen_counts`, `imported_styles_error_catalogue`) and the
      protocol-page assertions inside six other test files.
- [x] Delete every other plan (Decision 29).
- [x] Rewrite the root `README.md` and the architecture pages to the end
      state.
- [x] Rewrite the 78 pages that described the previous backend in part, by
      subject, each at or under 250 lines with the `Status` line:
  - [x] authoring;
  - [x] rendering;
  - [x] comparison and Changes;
  - [x] read model and delivery;
  - [x] Serve, watch, and the CLI;
  - [x] static build and publish;
  - [x] viewer;
  - [x] design mockups;
  - [x] CI, verification, and release.
- [ ] Confirm the landable pull requests merged: #135, #182, and the test and
      CI housekeeping; the user merges them.
- [ ] Tag the last TypeScript backend commit on `main` as `ts-backend-final`.
- [x] Write `scripts/rebuild/behaviour-table.mjs` on this branch: it reduces one
      captured scenario to the JSON table that the rebuild procedures define.
- [x] Capture reference outputs with the old CLI under
      `.context/rust-rebuild/reference/`: the example catalogue, the large
      fixture's four scenarios, and the moved, removed, Markdown document,
      ignore-region, and renderer-change states; run the behaviour-table
      script over them.
- [x] Delete, with the recorded approval: `src/`; the backend tests under
      `tests/` except the documentation, guide, and workflow policy tests that
      still apply; `scripts/package`, `scripts/preview`, `scripts/large`, and
      the verification runners that drive the old CLI; the
      preview deployment workflow; and the root package's `bin`, `exports`,
      `files`, and publish configuration.
- [x] Repoint or remove every live reference to the native engine contract
      before the teardown deletes `docs/protocol/mokly-native-engine.md`.
- [x] Trim `xtask`: the repository suite keeps the audit, Prettier, ESLint,
      the length audits, Rust formatting, Clippy, tests, and the file-length
      audit; a viewer suite runs the viewer typecheck and tests and the tooling tests
      under `tests/`; the package,
      unit, browser, and hydration suites and their remote shards are removed
      until later milestones add new ones.
- [x] Update `.github/workflows/ci.yml`, `release-please-config.json`, and
      `.release-please-manifest.json` for the reduced tree; keep the viewer
      release path.
- [x] Update `AGENTS.md` for the reduced tree: the commands, the repository
      rules, and the moment to read the `rust` skill, which then covers
      `crates/` as well as `xtask/`. Done on 2026-10-14 under Decision 38,
      ahead of the teardown.
- [x] Run `cargo xtask check` on the reduced tree until it passes.
- [x] Record the deleted top-level paths in the commit body.
- [x] Commit.

- [x] Apply the first M2 review fixes: restore release and workflow checks,
      make reference tables independent of legacy ids, and capture
      `stylesheet-edit` with used and unused CSS rules.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/reference/README.md`; sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m2.md`.
Review-fix evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m2/report-2.md`.
Second review-fix evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m2/report-3.md`.

## Milestone 3: Workspace skeleton and native packaging

At completion the Rust workspace builds, the `mokly` binary runs `--help` and
`--version`, and the platform packages, shim, and CI build steps exist.

- [x] Add the crates: `mokly-model` (shared shapes, canonical JSON, the prop
      schema profile and its validator on the `jsonschema` crate, generated
      TypeScript), `mokly-cli` (the binary, clap grammar, terminal output),
      `mokly-platform` (exclusive rename, process groups, Windows job objects),
      `mokly-git` (command runner, bounded batches), and `mokly-sidecar` (the
      client of the sidecar protocol). Later milestones add their own crates.
      Each crate has a README with the required sections.
- [x] Add the five `@mokly/native-<target>` platform packages linked from the private root, the shim in `@mokly/mokly` under `packages/mokly` that resolves the
      binary and checks versions, and the
      `cargo xtask build-native` and `generate-types` commands; `npm run build`
      builds the host target.
- [x] Resolve native installation with optional file links from the private root.
      The native packages stay outside npm's workspace list. The public CLI
      keeps exact registry versions. Approved in Milestone 3 change request 1.
- [x] Extend `xtask check`: Rust formatting, Clippy, tests, file length, and
      the viewer suite. CI builds the native artifacts in every job and on
      the Testbox through `rust-toolchain.toml`. The Native suite runs on
      hosted macOS and Windows runners.
- [x] Add `cargo xtask check-generated-types` as a standalone byte-identity
      check. Keep it outside every gate and CI job.
- [ ] Record the gate approvals from the Status section before adding the gates.
      The generated-TypeScript byte-identity and Rust advisory audit gates
      wait for the user.
- [ ] After user approval, add `cargo xtask check-generated-types` and the
      Rust advisory audit to the Repository suite and CI.
- [x] Apply review 2 findings 1 to 8: isolate xtask builds, preserve LF text,
      cover generated sidecar types and Native commands, align the Testbox
      docs, keep Required CI as an aggregator, and enforce Git's 64 MiB cap.
- [x] Commit.

Round 3 decision: Required CI only aggregates results and reports. Every job
that runs checks, and the Testbox, builds the host native artifact.

Evidence: `.context/rust-rebuild/delegation/m3/report-1.md` and
`.context/rust-rebuild/sweeps/m3-phase-a.md`. Round 1 fixes and evidence:
`.context/rust-rebuild/delegation/m3/report-2.md` and
`.context/rust-rebuild/sweeps/m3-r2-git.md`.
Phase B evidence: `.context/rust-rebuild/delegation/m3/report-3.md`,
`.context/rust-rebuild/delegation/m3/merge-decisions.md`, and
`.context/rust-rebuild/m3-phase-b-complete-gate.log`.
Round 3 evidence: `.context/rust-rebuild/delegation/m3/report-4.md`,
`.context/rust-rebuild/m3-r3-renormalize.log`, and
`.context/rust-rebuild/m3-r3-complete-gate.log`.

## Milestone 4: Catalogue model and discovery

At completion `mokly build` discovers a catalogue of HTML screens, HTML
components, Markdown documents, pages, and use cases, validates it, builds the
catalogue model, and reports diagnostics; rendering and output follow in later
milestones.

- [x] Implement roots, default globs, folder records, path identity, variants,
      moves hints, and the diagnostics of the identity contracts in
      `mokly-catalogue`.
- [x] Implement the front matter parser and the file kinds decided in
      Milestone 1, with exact diagnostics and line and column reporting.
- [x] Implement the catalogue model in `mokly-model` with canonical JSON and
      the generated TypeScript types; it lives in memory, with no file on
      disk.
- [x] Behaviour tests from fixtures: one catalogue per identity rule, every
      diagnostic, and the reference catalogue's entry set.
- [x] Add the data-only configuration loader and editor JSON Schema, the
      source-tree interface and working-tree adapter, and the definition-provider
      boundary for the sidecar.
- [x] Define public index v7, detail v1, and live descriptor v3 shapes, generate
      their TypeScript modules, and gate reader versions before payload fields.
- [x] Wire the discovery-only build command, warning reports, and strict mode.
- [x] Run the repository gate, Rust checks, type regeneration, package build,
      and the built shim smoke fixture.
- [x] Complete the full gate after integration with the Milestone 2 teardown.
      Recheck the example documentation links after its port.
- [x] Commit the implementation checkpoint. The number-policy decision remains open.

Evidence: `.context/rust-rebuild/sweeps/m4.md` and
`.context/rust-rebuild/delegation/m4/report-1.md`.
Integration evidence: `.context/rust-rebuild/delegation/m4/report-2.md` and
`.context/rust-rebuild/delegation/m4/merge-decisions.md`.
Review 1 fixes and evidence: `.context/rust-rebuild/delegation/m4/report-3.md`.
Final fixes and evidence: `.context/rust-rebuild/delegation/m4/report-4.md`.

## Milestone 5: HTML rendering and the render cache

At completion `mokly build` validates, renders HTML screens and components
into the bounded render cache, and reports diagnostics; it writes its output
from Milestone 12.

- [x] Implement HTML components and the entry props model in `mokly-html`:
      prop schemas under the JSON Schema profile with closed objects and
      their inference from merged props, props-driven variants, scalar
      coercion, one template language for screen and component bodies
      (`$name` prop references, `{{name}}` substitution, `mokly-if`,
      `mokly-viewport`, named slots), `mokly-instance`, and the component
      registry with the reserved `mokly-` prefix.
- [x] Implement screen composition: viewports, colour schemes, stylesheet
      rules, document assembly, `mock:` link rewriting, ignore regions with
      their scopes resolved, and the ownership annotations the comparison
      relies on.
- [x] Implement the render cache: content keys, the byte bound, eviction, and
      reads through the existing `mokly-source-interface` for working and Git
      trees; the `build`
      validation run with `--strict`; and the closure of referenced assets for Serve and the
      static output.
- [x] Implement stylesheet handling on `lightningcss`: imports, assets, and
      per-root bundles.
- [x] Port the example catalogue's HTML-only parts and add HTML fixtures; run
      the gap sweep against the rendering contracts; the example README
      follows.
  - [x] Replace `examples/basic/mokly.config.ts` with `mokly.config.json`
        under Decision 37.
  - [x] Add the example's HTML Team area: two screens with a variant, three
        HTML components with variants and slots, a page, a use case, a
        folder record, and a Markdown document.
  - [x] Rewrite `examples/basic/README.md` to the end state.
  - [x] Add HTML fixtures and run the gap sweep against the rendering
        contracts.
  - [x] Render the example's HTML part and check it at both viewports and in
        both schemes. Its stylesheets pass through the example's PostCSS
        module, which runs in the Milestone 8 sidecar.
- [x] Write the HTML authoring guides under `docs/guides`.
- [x] Commit.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m5.md`.
Integration evidence: `.context/rust-rebuild/delegation/m5/report-2.md` and
`.context/rust-rebuild/delegation/m5/merge-decisions.md`.
Review fix evidence: `.context/rust-rebuild/delegation/m5/report-3.md`.
Final fix and merge evidence: `.context/rust-rebuild/delegation/m5/report-4.md`
and `.context/rust-rebuild/delegation/m5/round-3-merge-decisions.md`.

The Git source-tree adapter is part of Milestone 9. The example port remains
assigned to its separate task.

Example port evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m5-example/README.md`.
HTML fixture sweep and controls evidence: `.context/rust-rebuild/sweeps/m5-html.md`
and `.context/rust-rebuild/delegation/m8-core/report-9.md`.
Final sweep review fixes and static/Serve evidence: `.context/rust-rebuild/delegation/m8-core/report-10.md`;
merge decisions: `.context/rust-rebuild/delegation/m8-core/merge-decisions.md`.

## Milestone 6: Serve

At completion `mokly serve` serves an HTML catalogue: the shell stub on every
shell route, the catalogue index v7, one entry detail per entry, the
documents, the live descriptor, the update event stream, and shutdown; the
viewer renders it after Milestone 7. No sidecar starts for a catalogue
without JavaScript.

- [x] Restore `npm run dev` to serve `examples/basic/mokly.config.json` with
      argument forwarding.

- [x] Implement the server in `mokly-server`: the stub, the index and entry
      detail routes with `Cache-Control: no-store`, the document and asset
      routes, the live descriptor, the event stream with the revision as the
      message id and the deployment id as its data, shutdown ordering, and
      the terminal output contract in the CLI.
- [x] Complete context-aware usage readers: validate recorded props against
      component schemas; recompute instance and slot keys and `propsKey` with
      the shared material key; validate usage references, ownership cycles,
      source locations, duplicate records, root ranges, and view ordering.
- [x] Behaviour tests: every route of the shell delivery contract that
      Milestone 6 serves, the identity and revision fences, and shutdown.
- [x] Treat repeated SIGINT delivery as one Serve shutdown request. The
      POSIX shim may forward a console signal already delivered to the binary.
- [x] Queue manual rebuilds from rich Serve, atomically replace their public
      state and document backend, and keep last-good state on a failed candidate.
- [x] Commit.

Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/merge-decisions.md`.
Gap sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m6.md`.
Smoke and screenshots: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m6-smoke/`.
Verification and report: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-1.md`.
Integration report: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-2.md`.
Review fixes and smoke: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-3.md`.
Viewer key domains and complete smoke: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-4.md`.

Final review fixes and integration: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-5.md`.

## Milestone 7: Viewer reads read model v7

Tags: ui

- [x] Update the viewer's data readers and validators to the generated read
      model v7 types.
- [x] Show a component's own props before its variants, offer the derived
      controls on screens with the zero-based step and the title-or-value
      select labels, and validate control input with a profile validator
      that generates no code, under the entry props contract; no
      other presentation change.
- [x] Replace server rendering and hydration in the viewer package with the
      client-rendered shell of the shell delivery contract: the `browser`
      entry mounts into the stub, index and detail readers replace
      `readCatalogue` and the bootstrap readers, `MoklyViewer` takes the
      index and detail sources, the `server` entry and `renderViewer` go,
      and the package README, rewritten under Decision 38, is checked
      against the package.
- [x] Run the viewer suite against the Milestone 6 routes.
- [x] Commit.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m7-checks/`; sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m7.md`.
Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m7/merge-decisions.md`.
Serve run (log, results, screenshots): `/home/vercel-sandbox/mokly/.context/rust-rebuild/m7-serve-run/log.md`.

## Milestone 8: Sidecar rendering for JavaScript

At completion React components, React screens, JavaScript pages, and
Storybook stories render through the sidecar, and the example catalogue
renders again.

- [x] Replace the configured-renderer refusal in both Serve and `build` with
      the sidecar bundle's complete source inventory (Milestone 6 review, finding 13).
- [x] Implement the sidecar protocol in `@mokly/mokly` and `mokly-sidecar`:
      process pool, newline-delimited JSON, cancellation, timeouts, and the
      fail-closed rules.
  - [x] Add the standalone Node entry, bounded NDJSON, method dispatch,
        exact-version hello, and the Rust pool's lazy process lifecycle.
  - [x] Test request deadlines, retry, recycling, shutdown, and queue
        cancellation with mocked Rust boundaries and real Node processes.
  - [x] Separate head and base generations, replay disposed generations on
        every worker, share canonical model wire values, and validate the
        CLI timeout override.
  - [x] Apply the approved resolved bindings, usage drafts, PostCSS contexts,
        and fragment-scoped registry style collection.
- [x] Implement consumer bundling in the sidecar with the bundler of Decision
      10, the module graph report, the consumer renderer module, React
      resolution from the consumer, and the optional consumer PostCSS worker.
  - [x] Add unevaluated esbuild generations, attributed facades, the JSX
        development shim, CSS Modules tables, and consumer style collectors.
  - [x] Map workspace PostCSS presets into each side and keep installed
        JavaScript and CSS under stable dependency graph names.
  - [x] Add the PostCSS worker and preserve local module locations, plugin
        creation lifetime, and dependency plugin names and globs.
- [x] Implement component, screen, page, and story renders, with
      `defineScreen` rendering over props, `json-schema-to-ts` for declared
      schemas and the `props` literal type for undeclared ones, schema
      inference for screens and stories, and `argTypes` as control hints; implement the fragment cache in
      Rust keyed by bundle generation, binding table, effective entry, class-map
      digest, handle, props, viewport, scheme, and
      the enclosing ignore scope; slot placeholders report their scope state;
      a stories file is a component entry whose stories are its variants.
  - [x] Add the authoring API with schema and literal prop inference, and
        standalone component, screen, story, and page renders.
  - [x] Connect resolved catalogue paths, complete usage records, schema
        validation, and fragment caching through the approved binding.
- [x] Implement `describe`: every definition the entry modules and stories
      files export, one per export, rejecting arrays containing definitions, with the
      story inventory; feed every definition into the
      catalogue model, and register JavaScript components by `element` with
      the uniqueness rule, the reserved `mokly-` prefix, and the reserved-prop
      failure of the components contract.
- [x] Reconcile the rendering page's authenticated fragment placements and
      logical inputs with the sidecar's typed instance and slot render-result
      records before connecting the Milestone 5 composition boundary.
- [x] Connect the Milestone 5 fragment and CSS interfaces: capture authenticated
      input and marker-placement metadata in the sidecar, resolve definition
      handles to catalogue identities, and supply the bundle generation,
      delivery roots, and component stylesheet lists to the native graph.
- [x] Extend the definition-provider boundary for `describe` handles,
      declared controls, story control hints, slot handles, excluded non-data
      prop keys, and authoring diagnostics; emit `props-not-data` after path
      derivation names the entry and key.
- [x] Implement live prop editing in Serve through the same render path.
  - [x] Add the shared `RenderGeneration::render_props` path with Rust prop
        validation, fragment caching, document composition, and closure checks.
  - [x] Wire the Serve live render route to the shared JavaScript runtime.
- [ ] Restore the example catalogue, the design catalogue, and a packed
      consumer smoke; run the gap sweep against the old rendering and
      component contracts.
  - [x] Read and classify the previous rendering and component rules and tests
        for the core integration gap sweep.
  - [ ] Compare captured example and large scenarios after the example port
        and comparison integration land.
  - [ ] Add the callback-only regressions from the M5 HTML sweep: conflicting
        inputs from impure slot replay, renderer mutation isolation, and the
        page helper call count. Cover and document the render-time failure of
        a component wrapper whose definition is not exported by an entry
        module. Cases 30, 32, 36, and 127 remain assigned here; native
        templates cannot exercise callback side effects or wrapper exports.
  - [x] Port the React example, the React components, and the design
        catalogue to the authoring API.
  - [x] Render both catalogues through the integrated sidecar and check every
        page at both viewports and in both schemes.
  - [x] Add the packed consumer smoke.
- [x] Update commands and test names in `examples/basic/README.md` and
      `examples/basic/specs/design/library/README.md` for the restored CLI.
- [x] Restore the example typecheck; validate or replace the viewer browser
      fixtures, including their component paths and cross-origin setup.
  - [x] Restore the example typecheck: the root typecheck includes the
        example.
  - [x] Validate or replace the viewer browser fixtures, including their
        component paths and cross-origin setup.
- [ ] Complete browser coverage for copied static output.
  - [x] Build and copy the example in global setup and run exact-file static
        checks in the normal four shards: navigation, inspection, no live
        endpoints, read-only props, resources, canonical links, deployment
        replacement, and public CORS. Port the current-only static/export/publish
        sweep cases and the design journeys.
  - [ ] Add comparison modes and historical comparison documents after the
        Milestone 12 join of the comparison engine. Keep their sweep rows open.
  - [ ] Add continuous `MOKLY_PLAYWRIGHT_FILE_DIR` runs in CI only after the
        user approves the new job. Include the private slot and variant file
        fixture and the design journeys checked by a manual run.
- [x] Restore the browser suite against `mokly serve` of the example: its
      four shards, the six remote Testbox commands, and the five-report
      aggregate that the CI verification and remote verification contracts
      define.
- [x] Add browser specs for the client-rendered shell: the stub mount, history
      routing, detail loading and retry, live publications without a page
      load, and the frame reload by `documentKey`; and the live prop edits:
      the 150 ms debounce, the rerender after a revision adoption or a
      `live.generation` change, the retry after a 409, cancellation on
      navigation, and read-only controls while no descriptor is installed.
- [ ] Complete the M8 viewer cases assigned by the browser sweep, including
      route/detail races, frame handoff, live prop edits, and preserved focus.
  - [x] Port the route, history, detail fence, mount, publication, and live
        edit cases.
  - [ ] Port the cases that stay under the viewer client-shell TODO in the
        sweep: mount-time frame ownership and the Browse exact-resource
        handoff; live edit validation, the viewport switch, an expired
        preview, and a context change during a pending render; the React
        example components with their Usage consumers, actual contexts, and
        inspector tabs; the design library's unset, Reset, and nested styles;
        an older response for the same route; use-case and page frames and
        the Usage loading state while evidence is unavailable; instance deep
        links; focus on an unchanged Usage link while a Changes completion
        is adopted; a published scheme swap while a redirect replaces a frame
        source; and the review-base sentence while a detail loads, which needs
        a served catalogue with a Git base.
  - [ ] When Serve stops publishing a render completion that changes no
        detail (review 8 finding 1, for the Serve owner), restore one index
        read (`toHaveLength(1)`) in the 409 spec of `shell_live_edits.spec.ts`
        and the exact revision in the first half of its adoption spec. Until
        then, the orchestrator accepts one index read per rejected revision.
- [x] M8 browser follow-up: make unexpected console errors and `pageerror`
      failures automatic for every browser page, with explicit per-test
      allowances for expected failures. Keep the shared sandbox notice rule.
- [ ] M8 browser follow-up: add Serve browser specs for the example's HTML
      screens, slot components, document page, and YAML user flow under
      `examples/basic/specs/example/team`, including native HTML screen links.

- [ ] Add the design catalogue checks that the verification and adoption
      sections of `mokly-design-components.md`,
      `mokly-design-component-library.md`, `mokly-component-design.md`, and
      `mokly-design-links.md` define.
  - [x] Restore current design artboards, library samples, the frozen screen
        inventory, shared component consumers and ownership, portable links,
        controls, and both viewport layouts through Serve.
  - [x] Portable design links, shared samples, and inspector disclosures
        directly from real `mokly build` output through `file://` URLs are
        checked by a manual run.
  - [ ] Complete the remaining design checks with their feature owners:
        M8 viewer owns live props; M9/M10 own stylesheet attribution and
        comparison output; M8 browser owns the static build acceptance checks.
  - [x] Check one served example in `tests/design_catalogue.test.ts`: the
        frozen inventory, the shared components and their consumers, family
        adoption, owner chains, stylesheet links and scopes, scripts, link
        targets and focus stops, control destinations, tag states, and
        reachability; prove each check with one mutation.
  - [x] Apply review 3 of the served checks: drain Serve's process group on
        every path, serve with `--base HEAD`, add the adoption table's family
        parts and the component explorer destinations, exempt only the brand
        link from the current-page mark, report non-anchor link markers, match
        every library root by class token, and make reachability one-way with
        the contract's runtime-only states.
  - [x] Add the browser checks with the restored browser suite: pointer and
        Tab/Enter activation, history, canonical outer URLs, preserved outer
        viewport selection, active rows, selection semantics, counts, missing
        states, highlighting and mask geometry, editable and read-only
        controls, standalone versus in-screen geometry, icons and carets,
        desktop divider alignment, comparison bars, the stacked frames, mobile
        sheets, responsive overflow, bounded scrolling, and portable link round
        trips.
  - [ ] Add the Changes checks after Milestone 9: the attribution matrix, one
        classification of the nine shared sheets per scenario, the rule
        records and the changed-entry union, and bounded base-side Git
        batching.
  - [ ] Add the Rust behaviour tests over the design catalogue after
        Milestone 9: a parent component renders its own views from its own
        props, the stacked frames' structure, every comparison caption tied to
        its recorded change, and the Checklist's Changes.
  - [x] Exercise the same journeys in the static output under the M8
        copied-static-output TODO, and cover the Review snapshot link fallback.
  - Keep the three design inventories aligned when a design changes:
    `tests/fixtures/design/inventory.json`,
    `tests/fixtures/design-library/browser-inventory.json`, and
    `tests/fixtures/design-library/screens.json`.
- [x] Add a browser spec for safe stage centring (Milestone 6 review 1,
      finding 7): at a narrow width, for example 1000 x 800, the component
      stage with both viewports starts its row at the stage's left edge and
      scrolls to the row's end, and a stage row that fits stays centred.
- [x] Port the viewer's frame inspector to the markers of the comparison
      contract (Milestone 7 Serve run): `inspector/ranges.ts` reads
      `mokly-component:start:r-N`, while Serve writes `mokly-instance` and
      `mokly-slot` markers with an `id` and leaves a component page's root
      region `r-0` without a marker. In Serve, hovering a screen frame turns
      it to the error state and disables Highlight components.
- [x] Port the Milestone 7 presentation into the design catalogue and settle
      its copy there (Milestone 7 review 1, finding 10 and the mockup gaps):
      the parent's own entry first in the variant bar, controls on screens,
      the stage loading state, the index failure state, the version failure
      state, the Props tab label against the mockups' "Controls", and the
      controls copy "Choose an available entry to edit props.",
      "Comparisons show the saved props. Return to Current to edit props.",
      "Open this catalogue locally to edit props." (also shown in Serve while
      the descriptor loads), "No editable props are declared for this
      entry.", and "Check the highlighted values." for a whole-props error
      that highlights no field.
- [x] Settle the component stage layout in the design port: with Both, the
      component mockups place the 390px mobile canvas and the desktop canvas
      side by side, as the shell does, and stack them from the stage's left
      edge below 760px.
- [x] Write the JavaScript authoring guides.

Evidence: `.context/rust-rebuild/delegation/m8-sidecar/report-1.md`
and `.context/rust-rebuild/sweeps/m8-sidecar.md`. Round 1 fixes and merge
decisions: `.context/rust-rebuild/delegation/m8-sidecar/report-2.md` and
`.context/rust-rebuild/delegation/m8-sidecar/merge-decisions.md`. Final part 1
fixes: `.context/rust-rebuild/delegation/m8-sidecar/report-3.md`.
Example and design catalogue port: `.context/rust-rebuild/m5-example/port.md`.
Frame inspector marker port and its Serve run: `.context/rust-rebuild/m7-inspector-run/log.md`.
Example and design catalogue render and visual check: `.context/rust-rebuild/example-visual/index.md`.
Design catalogue checks, their mutation proofs, and the packed consumer smoke: `.context/rust-rebuild/m5-example/design-checks/index.md`.
Review 3 fixes of the design checks and the smoke: `.context/rust-rebuild/m5-example/round8/index.md`.
Review 4 fixes, the built-site smoke, and its runs on the merged tree: `.context/rust-rebuild/m5-example/round9/index.md`.
The design links page split and the three packed smoke paths: `.context/rust-rebuild/m5-example/round10/index.md`.

Core integration evidence: `.context/rust-rebuild/delegation/m8-core/report-1.md`;
sweep: `.context/rust-rebuild/sweeps/m8-core.md`; merge decisions:
`.context/rust-rebuild/delegation/m8-core/merge-decisions.md`.
Core review fixes: `.context/rust-rebuild/delegation/m8-core/report-2.md`.
Final core review fixes: `.context/rust-rebuild/delegation/m8-core/report-3.md`.
Serve integration: `.context/rust-rebuild/delegation/m8-core/report-4.md`;
smoke artifacts: `.context/rust-rebuild/m8-serve-smoke/`.
Serve integration review fixes: `.context/rust-rebuild/delegation/m8-core/report-5.md`.
CSS integration review fixes: `.context/rust-rebuild/delegation/m8-core/report-7.md`.
Final core fixes and invocation-path smoke: `.context/rust-rebuild/delegation/m8-core/report-8.md`.

Browser case ownership: `.context/rust-rebuild/sweeps/m8-browser.md`.
Browser restoration checks: `.context/rust-rebuild/delegation/m8-browser/report-1.md`.
Browser merge decisions: `.context/rust-rebuild/delegation/m8-browser/merge-decisions.md`.
Browser review fixes: `.context/rust-rebuild/delegation/m8-browser/report-2.md`.
Final browser review fixes: `.context/rust-rebuild/delegation/m8-browser/report-3.md`.
Static and error-fixture follow-ups: `.context/rust-rebuild/delegation/m8-browser/report-4.md`.
Design journey coverage: `.context/rust-rebuild/delegation/m8-browser/design-journey-map-round-3.md`.
Copied-static journeys: `.context/rust-rebuild/delegation/m8-browser/design-journey-map-round-4.md`.
Client shell specs and the sweep's viewer cases: `.context/rust-rebuild/delegation/m7/report-15.md`.
Client shell review 7 fixes, the merge of `c6e15729`, and the M8 viewer sweep
rows as generator inputs: `.context/rust-rebuild/delegation/m7/report-16.md`,
`.context/rust-rebuild/delegation/m7/merge-decisions.md` (Merge 7), and
`.context/rust-rebuild/delegation/m7/sweep-overrides-shell.json`.
Client shell review 8 fixes: `.context/rust-rebuild/delegation/m7/report-17.md`.

- [ ] Commit.

## Milestone 9: Changes

At completion Serve and the CLI classify changes against the Git base with
tree comparison, CSS attribution, and base-side rendering from Git. Serve emits review
v8 and snapshot v4; the viewer renders them after Milestone 10.

- [x] Implement Git access in `mokly-git`: merge base, changed paths, bounded
      blob and tree reads, and archive extraction of a commit.
- [x] Add Git runner stdin and cancellation, SIGTERM then SIGKILL after
      one second, and drain process pipes before settling.
- [x] Add the part 1 base source reader, leased extraction cache, dependency
      input readers, three dependency tiers, and bounded install cache in
      `mokly-compare`, ready for the render graph connection.
- [ ] Connect Serve's ordered `cancel_git` hook to active Git work. Add a
      real-process shutdown test for a Git process that ignores `SIGTERM`.
- [x] Implement base-side rendering: the base commit's Git tree as a source
      tree through the render graph, on-demand extraction of the base commit into
      a cache keyed by commit, the three dependency tiers of Decision 12 with
      the bounded install cache, scripts disabled, the time limit, the
      `base-dependencies` warning, and the terminal line that names the cache
      directory.
      Part 1 gap sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-git.md`.
- [x] Apply final part 1 review fixes: sidecar repository roots, cache flush
      and trash handling, batched working hashes, independent tree bounds,
      rename encoding, warning locations, and concurrent cache misses.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/logs/m9-git/round3-targeted-tests.log`.
      Integration choices: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-git/merge-decisions.md`.
- [x] Milestone 9 part 2: implement `mokly-source-interface::SourceTree` over
      the commit-pinned Git index and batched blob reader. Cover projection,
      direct children, every mode, and typed IO errors.
- [x] Implement branch-point entry lookup and its shared verification cases:
      kind/case identity, accepted-pair precedence, removed destinations,
      counterparts, variant parents, stored titles, and generation isolation.
- [ ] Implement tree comparison in `mokly-compare`: ownership regions attached
      at composition,
      ignore regions, materiality on canonical trees, moves, documents, pages,
      affected consumers, and review result v8.
  - [x] Implement the HTML comparison engine, strict review v8 and snapshot v4
        readers, metadata, move pairing, and historical records.
  - [x] Resolve variant-only affected identity and actual-instance resource
        proof contracts before closing the engine.
- [ ] Implement CSS attribution in `mokly-css`: rule collection, diffing,
      selector matching with the keep list, own-page membership, the inline
      rule for whole-screen React entries, and a content-addressed parsed-CSS
      cache.
  - [x] Implement linked-rule collection, diffing, matching, catalogue-wide
        own-page proof, and a byte-bounded parse cache.
  - [x] Resolve multi-component selector ownership and inline evidence
        addresses. Connect page head styles.
  - [x] Connect sidecar style ownership through the base render provider.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/b-regression-final.log`.
  - [ ] Resolve user item 39 (review 6b finding 2): page-wide CSS-in-JS
        sheets are owned by the rendered parent in the code, so a child-only
        rule edit can create a direct parent change. Keep this behaviour until
        the user chooses the ownership rule.
  - [ ] Resolve user item 40 (review 6b finding 3): owned styles set material
        flags without per-rule records in the code. Consumer-instance matches
        of owned styles also supply implementation proof without those records.
        Keep the approved rule-evidence specification. Decide both evidence
        paths before adding records or changing the documented view-state rule.
- [x] Compute and retain HTML Changes in `mokly build`, with base selection,
      disabled Changes, invalid-base diagnostics, and terminal counts.
- [x] Apply comparison review round 1: exact instance proof, entry state and
      counts, strict failures, base warning scope, bounded resource reads,
      indexed attribution, move exclusions, and snapshot admission.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-2.md`.
- [x] Merge the renderer, viewer, and sidecar integration into the comparison
      branch after the first comparison review fixes.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Apply final comparison review requests: inline own-page proof, input-owned
      slots, scoped Git metadata, streamed large-resource digests, planning
      batches, empty-base catalogues, and named limit diagnostics.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-3.md`.
- [x] Integrate the shared sidecar runtime into comparison: leased base sources,
      dependency tiers, one pool and cache, cancellation, typed diagnostics,
      and PostCSS source-directory isolation.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-4.md`.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Isolate base JavaScript working-directory reads: sidecars run in the head
      repository, so `process.cwd()` reads in base code can read head files.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/a-regression-after.log`.
- [x] Apply shared-runtime review fixes: PostCSS child memory accounting, unique
      PostCSS contexts, base timeout recovery, streamed extraction, isolated
      test caches, and direct runtime regression tests.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-5.md`.
- [x] Integrate Changes with the static build pipeline for build and publish.
      Keep warning gates after comparison and retain the result for M12/M9.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Add the Comparing phase spinner and measured durations to build Changes.
  - [x] Connect the Comparing spinner to the static phase reporter.
  - [x] Include the comparison duration when the Changes phase settles.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/d-duration-tests.log`.
- [ ] Complete the final shared-runtime review: bounded memory sampling,
      canonical Node identity, ancestor dependency tiers, selected NODE_PATH
      priority, and direct base, extraction, timeout, and recycle tests.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-6.md`.
- [x] Implement per-importer Node resolution on the base side (review 5b,
      finding 1 option A). Resolve each bare import from its matching directory
      in the dependency tier and retain tier-two missing-directory fallback.
      This follows the merge of the interim warning policy in report 7.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/e-importer-paths-after.log` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/e-native-tests.log`.
- [x] Apply the last integration requests: early base pinning, terminal ownership,
      nested CSS lookup, bounded memory tables, and recycle back-off.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-7.md`.
- [x] Integrate M11 with Changes: unify streaming digests, retain compiled
      recipes and epoch releases, preserve slot back-off and context affinity,
      and verify base-side parent-death cleanup with PostCSS child processes.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-7.md`.
- [x] Align the Rust review reader with viewer review 5, finding 10: current
      variants first, previous paths on moved pairs, and UTF-16 reason targets.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/c-regression-after.log`.
- [x] Apply the approved engine review 6 fixes: tracked dependency sources,
      bounded worker reuse by source root, cleanup consistency, directory
      variables, owned-style moves, trusted inline ownership, and phase formatting.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/repository-before-merge-result.json` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/sidecar-node-all-after-gate.log`.
- [x] Integrate the engine fixes with the iterative rebuild trees, preserving
      trusted style annotations through cloning, repair, equality, and cache accounting.
      Decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Apply engine review 7 launch and test fixes: Windows path normalization,
      npm directory isolation, independent root-selection coverage, and restored
      rule-evidence wording. Record reserved names and owned follow-ups.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round10/targeted-results.json` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round10/pool-test-mutation-result.json`.
- [x] Merge the static Changes join into the engine branch. Keep owned-style
      comparison and shared projections together, isolate both reader test
      modules, and supply the duration fixture's base ref.
      Decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [ ] Reduce source-root replacements in the shared Changes engine for build,
      publish, and Serve. Owner: M9 engine delegate (`m9-compare`). Render each
      side's planned views in one pass before pairing, or batch requests by root.
      Acceptance: one worker spawns a small constant per side switch plus
      recycles, independent of the number of paired views. Keep the pool bound.
- [ ] Decide whether sidecars and PostCSS children remove all `npm_*` variables
      and head `.bin` entries from `PATH` (review 7 finding 5B). Keep other
      inherited values until the user decides.
- [ ] Decide enforcement for source or installation paths beneath the reserved
      `node_modules/.mokly-roots/` prefix (review 7 finding 7). The reservation
      is documented; a new rejection requires the user's decision.
- [ ] Implement background classification in Serve, the change snapshot v4,
      and on-demand comparison snapshots and panes.
  - [ ] Measure interleaved head/base work in Serve background Changes and
        reduce source-root replacements within the configured pool bound,
        including the one-worker case. Integrate shared-engine batching with
        Serve-only interleaving (review 6a finding 2, option C).
- [ ] Behaviour tests from the captured scenarios, rewritten in the new
      formats; run the gap sweep against the Changes and attribution
      contracts.
  - [x] Add the index v7/detail v1/review v8 adapter and HTML behavior fixtures.
  - [x] Run the bounded previous-contract and test-title sweep.
        Part 2 sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-compare.md`.
  - [ ] Replay the eleven full references after the sidecar and source
        migration are ready. Every captured catalogue has JavaScript entries.
- [ ] Port the deferred native Changes browser fixtures in the M8 browser
      sweep: base references, moved/removed entries, comparison requests and
      renewal, and CSS evidence. M9 supplies the fixtures; M10 owns their UI
      assertions. Keep the duplicate component-explorer cases in one suite.
- [ ] Add the stylesheet attribution tests over the design catalogue that
      `mokly-component-design.md` and `mokly-design-component-attribution.md`
      define: the nine shared sheets per scenario, the pinned rendered
      stylesheet links, the exact per-entry rendered-resource and rule
      records, the exact changed-entry union, no affected consumers for
      unresolved shared rules, and the attribution acceptance matrix.
- [ ] Close the large-fixture Changes reference gap: the old captures have
      no Changes result or rule evidence, and all four catalogue captures
      are byte-identical. Use the stylesheet-edit reference for CSS evidence;
      prove large-scale Changes with the Rust implementation.
  - [x] Prove bounded full-comparison work at 128 and 512 component parents
        with variants, and shared before/after CSS parse reuse.
- [ ] Commit.

## Milestone 10: Viewer reads review v8 and snapshot v4

Tags: ui

- [x] Update the viewer's review and snapshot readers to the generated types;
      comparison panes and Changes presentation do not change.
- [x] Check the shell's projection of the entry detail's review v8 rule and
      resource records (`packages/viewer/src/review/view_evidence.ts`)
      against Milestone 9 output.
- [x] Align the viewer's `historicalSnapshotId` with the snapshot identity of
      the serialization contract: `sourceKind` is the literal `base`.
- [x] Trim `@mokly/viewer/data` to the surface that `mokly-viewer.md` and the
      package README describe (the path functions, the directory names, the
      path grammar, and the prop schema validators) when review v8 replaces
      the review v7 and manifest types that it still exports.
- [x] Add user-facing wording for the review v8 `implementation` reason under
      the `product-ui` rules. Explain actual-instance component impact while
      preserving the component's own view states.
- [ ] Run the viewer suite against Milestone 9 output.
- [ ] Complete the M8 browser sweep's comparison UI cases against review v8
      and snapshot v4, including filter disclosure, Changed membership,
      comparison scroll regions, retained focus, and stylesheet Details.
- [x] Make the viewer follow the settled design copy and states of the design
      catalogue (version failure, controls copy and states, loading states).
      Source: the design entries `design/browse/loading/**` and
      `design/components/controls/**`,
      `examples/basic/specs/design/components/controls/parts/copy.ts`, and
      `mokly-viewer-namespace.md`, `mokly-viewer.md`,
      `mokly-shell-delivery.md`, and `mokly-component-controls-design.md`. The
      copy tables in `.context/rust-rebuild/delegation/m5-example/report-2.md`
      and `report-3.md` there list the differences from the viewer.

Settled copy and states with their Serve run: `.context/rust-rebuild/m10-copy-run/log.md`.
Review fixes of the copy and states with their Serve run:
`.context/rust-rebuild/m10-copy-run-2/log.md`.
Final review fixes and their check logs:
`.context/rust-rebuild/delegation/m7/report-9.md`.
The 409 index refresh, the mobile pending pill, and the frame sandbox message:
`.context/rust-rebuild/delegation/m7/report-10.md`.
The review v8 reader, the base snapshot identity, the `./data` trim, the
`implementation` wording, and the projection check against Milestone 9 output:
`.context/rust-rebuild/delegation/m7/report-11.md`.

- [ ] Commit.

## Milestone 11: Watch and incremental rendering

- [x] Reuse unchanged encoded details across watched generation rebuilds
      (Milestone 6 review 2, finding 1C).

- [x] Tie Serve's watching copy to the active watcher and cover its terminal
      output (Milestone 6 review, finding 10).
- [x] Implement the content-addressed render graph: inputs hashed per entry,
      invalidation from the sidecar's module graph, HTML component
      dependencies, stylesheet dependencies, and PostCSS reports.
- [x] Implement the watcher with the denial rules, rebuild on change, bundle
      replay for HTML-only edits, and live updates to the viewer through the
      index and entry detail routes under one revision, with frames reloaded
      by document key and no page reload.
- [x] Release PostCSS contexts and replaced sidecar generations when the last
      graph that uses them drops. Design ownership with Serve revision fences,
      cancelled requests, and watch replacement; prevent an old graph from
      using new bindings or class maps under an old fragment key (M8 review 1,
      finding 8).
- [x] Behaviour tests that count rebuilds and renders per change.
- [ ] Port the M8 browser sweep's watch and folder-update cases after watcher
      integration. Use publication events and document keys in place of page
      reloads. Keep shutdown, moves, titles, search, and disclosure coverage.
- [x] Preserve saved component frame document keys when controls supply view
      records. Only temporary preview URLs bypass the saved document key.
- [x] Bound retained stylesheet results and keep generation source snapshots
      valid after cache eviction.
- [x] Keep explicit watch rules subject to directory denials.
- [x] Observe confined ancestors and recover required inputs after a parent
      directory moves or is replaced.
- [x] Sweep the previous watch and runtime rules and test cases at `0bbd737e`.
- [x] Smoke-test HTML, CSS, and React edits through the shim in Chrome.
- [x] Verify generated types and pass the complete gate.
- [x] Commit.

Evidence: `.context/rust-rebuild/delegation/m11/report-1.md`,
`.context/rust-rebuild/m11-smoke/`, and `.context/rust-rebuild/sweeps/m11.md`.

- [x] Verify that watching prunes build outputs and reservation paths by path,
      without ownership-marker parsing.

- [ ] After the first hosted macOS and Windows runs, make event loss recoverable
      there: choose a repository-root rescan after each macOS batch and an
      exact-input stamp check on Windows, or one recursive watch per root on both
      systems; tests.
- [x] Report the composition warnings of every Serve attempt once, including
      on-demand and background renders, through an attempt-scoped sink with a
      seen set kept across a failed attempt (`mokly-build-warnings.md`).

Evidence: `.context/rust-rebuild/delegation/m11/report-4.md` and
`.context/rust-rebuild/sweeps/m11-warnings.md`.

- [x] Correct Serve warning review findings 1 to 7 and flush the current
      attempt's pending warnings on fatal server failure.

Evidence: `.context/rust-rebuild/delegation/m11/report-5.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

- [x] Merge comparison-engine updates, apply one cancellation rule to fatal
      Serve warnings, and prove destination composition.

Evidence: `.context/rust-rebuild/delegation/m11/report-6.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

## Milestone 11.1: Watch review corrections

- [x] Merge rebuild updates through `09821954` and preserve both branches.
- [x] Order Serve shutdown and reject changes to running pool settings.
- [x] Batch native watches, normalize platform events, recover event loss,
      and extend exact inputs without replacing root observers.
- [x] Queue resource attachment, close adoption races, and retry failed
      attempts when newly authored inputs are repaired.
- [x] Match watched failure layout, bound debounce conversion, and separate
      filesystem edits from manual rebuild tests.
- [x] Release pool epochs and PostCSS contexts without blocking graph drops.
      Give each PostCSS context one worker and release idle workers promptly.
- [x] Retain compiled code for old-generation replay and reuse compilations
      when only evaluation settings change.
- [x] Memoize digest-only reads without retaining bytes, check resource
      confinement, and cover React and Storybook metadata in bundle reuse.
- [x] Verify operation counts, failed JavaScript candidates, manual rebuilds,
      detail usage reuse, watcher bursts, and lifecycle races.
- [x] Update the watch sweep and specifications. Keep bundle-level CSS
      invalidation while the user considers review 1b-6.
- [x] Pass the complete gate, regenerate types without drift, and repeat the
      Chrome edit smoke without the sidecar timeout override.
- [x] Commit and write the final round 2 report.

Evidence: `.context/rust-rebuild/delegation/m11/merge-decisions.md` and
`.context/rust-rebuild/delegation/m11/report-2.md`.

## Milestone 11.2: Final watch corrections

- [x] Merge static output, release, viewer recovery, and HTML sweep changes.
- [x] Correct native registration recovery, event mapping, and negative debounce.
- [x] Use one startup and serving lifecycle and prove process shutdown order.
- [x] Keep sidecars inside their binary lifetime with parent-death protection.
- [x] Restore shared compilation across slots and recycling, bound recipes,
      retain failed peer resolution, and hash resolution metadata and membership.
- [x] Fix pool scheduling, cleanup notices, and per-path digest concurrency.
- [x] Cover two-sidecar operations, manual rebuild counts, and watcher targets.
- [x] Align diagnostics, lifecycle docs, and the gap sweep. Record deferred work.
- [x] Pass the repository suite, affected tests, type generation, and the
      two-sidecar Chrome smoke without a timeout override.
- [x] Check the complete-gate disk condition and record the merge-time gate
      when less than 15 GB is free.
- [x] Commit and write the final round 3 report.

Evidence: `.context/rust-rebuild/delegation/m11/report-3.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

## Milestone 12: Static build and publish

- [x] Apply the final comparison join requests: viewer eligibility in both readers,
      shared removed records and details, ready raw-byte preservation, and merged checks.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-8.md`.

- [x] Apply comparison join review 4: shared projection, view membership, private
      snapshot contract, branch tests, indexed workspaces, timings, and merged verification.
- [x] Complete timing records for dependency `tier`, comparison view counts, and
      `review.changed-paths` in the shared Changes pipeline (review 4, finding 7).
- [x] Apply publication review 6 findings 2 and 3: accurate missing-set evidence,
      complete cleanup after receiver failures, child cancellation, and explicit
      unavailable-output checks. Keep the publish warning decision open.

- [x] Implement the static output of `mokly build` in `mokly-static`: one
      stub per shell route, the catalogue index, the entry details, the
      documents, the comparison generation, the shared `mokly-model` ownership
      marker writer, the `--out` option with its default `mokly-static/` output
      directory, and the transaction with backup, exclusive rename, and rollback.
  - [x] Write deterministic current output, head-only inspector metadata,
        canonical index and details, exact package assets, and shared ownership.
        Implement reservations, exclusive installation, rollback, bounded cleanup,
        input rechecks, and config-relative output selection.
  - [x] Join the Milestone 9 comparison generation, removed records, and detail
        evidence before identity finalization. Repeat the comparison-specific
        reference scenarios after that integration. The join must populate upload
        `baseRef` instead of null.
        Nest build review spans under `output.write` with the caller context.
        Repeat the Changes-enabled build-directory entry delivery cases;
        their current-only acceptance is complete.
  - [x] Add subprocess recovery tests through a test-only fault seam for rollback,
        backup cleanup, cancellation plus cleanup, and cleanup-only failure.
        Include process-level configuration and staging signal faults.
        The recovery page stays in progress for the M9 stages and the open
        forced-exit decision recorded under review.
  - [x] Add an independent reader of the installed ownership and upload fixtures.
        Keep ownership, upload exchange, and validation Status lines until this
        reader and the M9 comparison join are verified.
  - [x] Complete the sweep rows owned by M12 static, transaction, and static
        closure acceptance. Add the remaining exact destination races,
        reservation mutations, Unicode/NUL rename paths, imported resources,
        private templates, host-normalized paths, abandoned lock retention,
        and signal-handler release cases named in the sweep.
- [x] Implement publish, which builds into its own directory first, through
      the unchanged exchange v1: plan, blobs,
      complete, retries, accounting, the clean-checkout and uncommitted
      changes rules, and the upload validation fixtures.
  - [x] Implement the `mokly-publish` exchange client with immutable output
        snapshots, metadata v2, ownership v3, bounded HTTP, retries, expiry,
        one re-plan, digest accounting, and public fixture tests.
  - [x] Add clean-checkout checks, cancellable Git calls, the static-output
        trait, and the pre-build private-directory line. Keep completed
        output after upload failure.
  - [x] Connect `mokly-static` to the CLI-owned publish adapter and its rich
        terminal phases. Both crates use the shared output shapes and marker
        writer in `mokly-model`. Verify real rendering, transaction cancellation,
        and deployment identity. Cover spawned SIGINT/retry uploads, rich phase
        transitions, source changes, and the deferred gap-sweep scenarios.
    - [x] Complete the sweep rows owned by M12 publication acceptance: assigned
          credentials, checkout variants, interrupted
          compiler diagnostics, rich summary styling, and every retry status
          through the real process.
    - [x] Move `Directory`, `DirectoryFailure`, `StaticUnavailable`,
          `BuildWarnings`, `Build`, `Uncommitted`, and `HeadChanged` from
          `mokly-publish` into the CLI publication error contract when the
          static adapter lands.
- [x] Add the `git-uncommitted` detail layout and avoid repeated detail and
      recovery-hint sentences in terminal errors.

Publish client gap sweep: `.context/rust-rebuild/sweeps/m12-publish.md`.
Publish client review fixes and TLS checks:
`.context/rust-rebuild/delegation/m12-publish/report-2.md`.
Publish client final review and merge decisions:
`.context/rust-rebuild/delegation/m12-publish/report-3.md` and
`.context/rust-rebuild/delegation/m12-publish/merge-decisions.md`.

- [x] Restore the preview deployment workflow on the new CLI.
- [x] Write the build and publish guides.

Static output evidence: `.context/rust-rebuild/delegation/m12-static/report-1.md`,
`.context/rust-rebuild/m12-smoke/`, and `.context/rust-rebuild/sweeps/m12-static.md`.
Round 1 fixes and merge decisions: `.context/rust-rebuild/delegation/m12-static/report-2.md`
and `.context/rust-rebuild/delegation/m12-static/merge-decisions.md`.
Last fix round: `.context/rust-rebuild/delegation/m12-static/report-3.md`.
Non-comparison M12 acceptance: `.context/rust-rebuild/delegation/m12-static/report-4.md`
and `.context/rust-rebuild/sweeps/m12-static.md`.
Final acceptance fixes: `.context/rust-rebuild/delegation/m12-static/report-5.md`.
Comparison join and static browser acceptance: `.context/rust-rebuild/delegation/m12-static/report-6.md`.
Comparison join review 4: `.context/rust-rebuild/delegation/m12-static/report-7.md`.
Publication adapter acceptance: `.context/rust-rebuild/delegation/m12-static/report-9.md`.
Publication review and timing acceptance: `.context/rust-rebuild/delegation/m12-static/report-10.md`.

- [x] Commit.

## Milestone 13: Release packaging

- [x] Build and pack the viewer before the CLI authoring declarations and
      CLI `prepack`; verify this order in clean package consumers.
- [x] Add the release build matrix for the five targets, the package set
      (viewer, five platform packages, CLI), the registry guards, and the
      publish order.
  - [x] Restore paired tags, native archive inspection, all package manifests,
        registry guards, and native/viewer/CLI publication ordering.
  - [x] Add Linux x64, Linux ARM64, macOS ARM64, and Windows x64 jobs.
  - [x] Settle the Intel macOS runner-policy exception and add its matrix row.
- [x] Update Release Please for the package set and write the breaking-change
      release note for the first 0.x release of the new core.
- [x] Make Release Please update the exact `@mokly/viewer` pin in
      `packages/mokly/package.json` with the viewer release. Test the manifest
      and lockfile updates together.
- [x] Verify that Release Please preserves the private root native `file:`
      links and keeps the public CLI native versions coordinated. The binary
      embeds the CLI package version at build time.
- [ ] Verify native TLS on macOS and Windows CI. Build all five target
      binaries with a target C toolchain and check `ldd`, `otool -L`, or
      `dumpbin /dependents` for an unintended crypto shared-library dependency.
- [x] Reconnect the Node agreement and profile-selector tests to the shim's
      gate and tested versions; compare Testbox with the native CI runtime.
- [ ] Dry-run the release scripts locally; the real publication is post-merge.
  - [x] Run the local steps that need no credentials or registry write against
        a scratch checkout and record the blocked steps.
  - [ ] Complete the seven-package pack, reuse, and smoke with all native
        archives from the hosted target builds.
- [ ] Settle Release Please selection for core-only commits under the
      Milestone 15 review decision.
- [x] Run the installed static output and Serve smoke after their integration.
  - [x] Run installed Serve with the tiny HTML catalogue.
  - [x] Run installed static output after Milestone 12 supplies the writer.
  - [x] Make `npm run package:smoke` require the built site once Milestone 12
        supplies the writer.
- [x] Cover the three paths of the previous packed smoke: zero-install
      `npx --package @mokly/mokly mokly` with an empty cache, configuration
      discovery from a nested directory, and a document page through the
      installed CLI.
- [x] Integrate the Milestone 8 part 2 npm-version fix before release checks
      can pass; the bumped-copy sidecar tests and version-path regression stay
      required.
- [x] Commit.

Release package evidence: `.context/rust-rebuild/delegation/m13/report-1.md`.
Release gap sweep: `.context/rust-rebuild/sweeps/m13-release.md`.
Release review and merge decisions: `.context/rust-rebuild/delegation/m13/report-2.md`
and `.context/rust-rebuild/delegation/m13/merge-decisions.md`.
Final release review fixes: `.context/rust-rebuild/delegation/m13/report-3.md`.
Release integration: `.context/rust-rebuild/delegation/m13/report-4.md` and
`.context/rust-rebuild/delegation/m13/merge-decisions.md`.
Static release verification and smoke scope comparison:
`.context/rust-rebuild/delegation/m13/report-5.md`.
Packed example smoke with the built site on the merged tree:
`.context/rust-rebuild/m5-example/round9/package-smoke.log`; it fails when the
site is absent: `.context/rust-rebuild/m5-example/round9/package-smoke-no-site.log`.
Packed example smoke with zero-install npx, nested configuration discovery,
and a document page: `.context/rust-rebuild/m5-example/round10/package-smoke-1.log`;
its mutation runs: `.context/rust-rebuild/m5-example/round10/mutations/`.

## Milestone 14: Large-project acceptance

- [ ] Obtain user approval for the current 2 GiB per repository cache namespace
      and the shared 120-second dependency preparation allowance before adding
      these values to the timings contract.
- [ ] Forward sidecar timing records and add core `sidecar.spawn` and
      `sidecar.recycle` spans under the timings contract.

- [ ] Restrict static fingerprints to configured roots, inventoried sources,
      and reached closure files. Measure this boundary under the large fixtures.

- [ ] Port the large fixture generator with HTML and React variants and the
      four-scenario benchmark harness; record the time and memory budgets, the
      dependency install time limit, and the render and install cache bounds
      in the timings contract once approved.
  - [x] Port HTML/React generation, both-variant build, and HTML Serve measurement.
  - [ ] Measure React Serve on a suitable machine with a configurable memory stop.
  - [ ] Connect Changes and watch to their delivered browser events.
  - [ ] Verify the comparison engine's tree walks after M9 integration.
        Cover recursive `owned_styles::visit`, `owned_style_instances::walk`,
        and `inline_styles::collect` in `mokly-compare`. Also remove the
        per-element copy of enclosing instances in `owned_style_instances::walk`.
  - [ ] Measure isolated dependency installs and propose additional budgets;
        retain the approved usable startup budget of under 5000 ms.
- [ ] Run the fixture, the bookfolio catalogue, and the Mokly Cloud catalogue
      through build, serve, Changes, and watch; save the evidence
      under `.context/rust-rebuild/`.
- [x] Make tree conversion, composition, serialization, destruction, and all
      tree walks iterative; remove dependence on the temporary 64 MiB stacks.
      The M5 memory follow-up removes quadratic ancestor-list retention and
      subtree copies in link controls. Evidence:
      `.context/rust-rebuild/delegation/m5/memory-report.md` and `report-4.md` there.
- [x] Review the `plaintext` re-parse limit: closing tags can become text, so repeated parsing can change the tree (M5 review 2, finding 6).
- [ ] Decide whether reconstructed `plaintext` text writes raw characters;
      keep its escaping rules until approved (M14 review 1a finding 1B).
- [ ] Resolve authored-input recursion in YAML front matter (`mokly-catalogue`),
      CSS scanners (`mokly-css`), and `lightningcss`. The HTML tree guarantee
      excludes these paths. New input bounds or wider rewrites need a decision.
- [ ] Replace the old baseline-output cold reset with M9 leased-cache preparation
      and delivered Changes measurements in the M14 harness.
- [ ] Measure generation source-snapshot retention and per-root CSS asset
      preparation with large asset inputs; keep total working memory within
      the approved acceptance budgets, in addition to the artifact-cache bound.
- [ ] Complete the gap sweep: every triage decision is in a spec or recorded
      as an accepted difference for the release note.
- [ ] Commit.

- [ ] Verify that a sidecar emitting a large stderr stream drains safely at
      shutdown and leaves no process behind (M11 sweep, watched_serve case).

Part 1 evidence: `.context/rust-rebuild/delegation/m14/report-1.md`.
Part 1 gap sweep: `.context/rust-rebuild/sweeps/m14-part1.md`.
Part 1 round 2 evidence: `.context/rust-rebuild/delegation/m14/report-2.md`.
Part 1 round 3 evidence: `.context/rust-rebuild/delegation/m14/report-3.md`.
Part 1 merge decisions: `.context/rust-rebuild/delegation/m14/merge-decisions.md`.

## Milestone 15: Verification, close-out, and review

- [ ] Move the 0.14-era notes in `npm-release-notes.md` and the format note to
      the history page at close-out; retain their links and migration content.
      Commit `05923728` already moved the Publish Checkout, Removed Public
      Options, and Portable Namespace notes there.

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Open the pull request. Its description and squash body write `{target}`
      for the package placeholder, justify each merge decision with its paths,
      and record every approved removal.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - [x] Reconcile the inherited M14 round 3
        `resident_set_recycles_only_after_one_gib_is_exceeded` flake with M9.
        The shared fixture seeds its epoch and cleanup uses one staleness rule.
        The M14 isolated rerun passed; its missing epoch let idle cleanup take
        the asserted slot. Evidence: M14 `report-3.md` and
        `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/merge-recycle-regression.log`.
  - M8 browser follow-up, Low severity, Small effort: investigate the existing
    `frame_adapter_navigation.spec.ts` posted-message assertion. It returned
    no navigation event once and passed unchanged after rerun. M8 viewer owns
    the suspected message/animation-frame ordering. Recommended A: wait for
    the message event. Evidence is in the browser delegate's `report-4.md`.
  - [x] Milestone 13 integration follow-up: resolve the full example's CSS-module
        startup failure so strict build and `npm run dev` smoke checks pass.
        Evidence: `.context/rust-rebuild/delegation/m8-core/report-6.md` and
        `.context/rust-rebuild/m8-css-modules-smoke/`.
  - Milestone 13 review 2 follow-up: CI evidence selection compares a literal
    workflow path in `evidence_contract.mjs`; review numeric workflow identity
    matching so a GitHub `path` ending in `@main` can select valid evidence.
  - Milestone 13 review 1, finding 5: the user must settle the Release Please
    component for core-only commits; keep the `packages/mokly` layout until
    that decision. Native builds and paired-tag publication remain unchanged.
  - Milestone 6 review 2, finding 6: decide failed-render detail status and
    Usage copy; keep all Used by lists unavailable after one unavailable view
    until the next generation while the user decision is pending.
  - M8 sidecar review D2: the user must settle schema validation of dynamic
    wrapper props before the adapter runs; add no validator or callback yet.
  - Milestone 9 part 2 review 3, finding 2: settle dependency selection for
    HTML-only catalogues that import package CSS; retain working dependencies
    until the user decides.
  - M8 core review 3, finding 2, and review 6, finding 7: settle saved-prop
    control bounds and declared steps that conflict with schema multiples or
    integer values. Keep the current validation until the user decides.
  - Milestone 9 part 1 review 1, finding 11: user decision pending on support
    for package managers other than npm; retain the npm-only fallback policy.
  - Milestone 9 part 1 review 1, finding 12: user decision pending on checkout
    conversion for base render/resource bytes; retain raw Git blob bytes.
  - Milestone 12 static review 3, finding 4: the packed native binary scan for
    `MOKLY_TEST_` needs user approval for a new gate. The module-erasure test
    checks only compiler exclusion of the debug fault module.
  - Milestone 12 static review 2, finding 6: settle forced build exit during
    install, rollback, and cleanup. Keep the current forced exit until decided.
  - Milestone 12 publish review 1, finding 8: decide the TLS trust-root policy;
    keep the OS trust store until the user decides.
  - Milestone 12 publish review 1, finding 13: decide private-directory retention
    after success; keep the existing retention until the user decides.
  - Milestone 5 review 1, finding 5: decide the declared component stylesheet
    delivery model; keep the current bundled code and pages pending the user.
  - Milestone 5 review 2, finding 9: decide unknown attributes on ignore wrappers; keep the current rejection pending the user.
  - Milestone 4: decide how to handle prop numbers that cannot round-trip through JavaScript number spelling.
  - Milestone 4 review 1, finding 10: decide whether and how to bound YAML alias expansion.
  - Milestone 7 review 1, finding 12: decide whether to delete the
    former-format fixtures `docs/protocol/fixtures/catalogue-v4.json` to
    `catalogue-v6.json` and their `.prettierignore` lines; it waits for the
    user.
  - Milestone 5: `{{ name }}` with inner spaces settled by Decision 39 on
    2026-10-15. `.prettierrc.json` stays: Prettier's Angular parser rewrites
    `{{open-seats}}` to `{{ open - seats }}` and stops on a literal `{`.
  - Milestone 5: settled on 2026-10-15; the example drops its `watch.rules`
    reload rule, which had no effect.
  - Milestone 8 example port review 1: the Milestone 10 TODO that makes the
    viewer follow the settled design copy changes the viewer's presentation,
    a non-goal of this plan; it needs the user's approval.
  - Milestone 8 example port review 1, finding 6: option B (a component parent
    renders without caller slot content) is documented; decide option C,
    which lets a component parent supply its own slot content (a contract
    change).
  - Milestone 8 example port review 2, finding 9: settled on 2026-10-16. The
    design links page is three pages within the 250-line limit, its cap is
    gone, and its retry link opens the exact paragraph.
  - Example visual check (report 6), open findings for the user:
    1. Use-case steps ignore the mobile layout. Severity Medium, effort
       Medium. Recommended: A, the shell shows each step's mobile view in a
       phone frame below 760px, as the use-case mockup does, and
       `mokly-shell-device-chrome.md` follows.
    2. Desktop component canvas width differs. Severity Low, effort Small.
       Recommended: B, the component design and the mockups adopt the shell's
       fixed 1024px desktop canvas.
    3. The shell stub declares no icon. Severity Low, effort Small. Settled
       at `da23c1ce`: the stub declares the packaged Browse icon, so no
       `/favicon.ico` request fails, and the packed smoke has no icon
       allowance.
  - Milestone 3 Phase A review 1, finding 16: the publish warning rule needs
    a user decision before Milestone 12.
  - Open from the end-state rewrite of 2026-10-14 (the rewrite reports are
    consolidated here):
  - A: settled by Decision 31 on 2026-10-14.
  - B: settled by Decision 32 on 2026-10-14.
  - C: settled by Decision 31 on 2026-10-14.
  - D: settled by Decision 38 on 2026-10-14.
  - E: settled by the orchestrator's M5 brief and final change request on
    2026-10-15: rewrite guides at their milestones. The viewer README, the
    xtask README, and `AGENTS.md` follow Decision 38.
    The teardown deleted `guides_cli`, `guides_ci`,
    `guides_upload_validation`, and `guides_authoring`, which compared the
    guides with the old CLI and authoring API. `guides_copy`,
    `guides_structure`, and `guides_versions` remain. The guides contract
    requires shipped behaviour. The Milestone 5 task explicitly directs the
    HTML authoring guide rewrite. Continue each later guide at its milestone.
  - F: settled by Decision 36 on 2026-10-14.
  - G: settled on 2026-10-14; the release management page follows the
    seven packages of the release contract.
  - H: settled on 2026-10-14; the components contract states that a
    variant's `slots` maps declared slot names to React nodes.
  - I: settled by Decision 33 on 2026-10-14.
  - J: settled by Decision 37 on 2026-10-14.
  - K: settled by Decision 31 on 2026-10-14.
  - L: settled on 2026-10-14; the sidecar contract reports the module graph
    with its import edges and names the JSX development shim.
  - M: settled by Decision 36 on 2026-10-14.
  - N: settled by Decision 35 on 2026-10-14.
  - O: settled by Decision 36 on 2026-10-14.
  - P: settled on 2026-10-14; the five design pages verify through the
    served example and the browser suite.
  - Q: settled on 2026-10-14; `ci-test-timing.md` is rewritten to the
    end-state suites.
  - R: settled by Decision 36 on 2026-10-14.
  - S: settled on 2026-10-14; the README keeps the Status line and the
    `plans/` directory link only, and the policy names that link.
  - T: settled on 2026-10-14; Milestone 8 restores the browser suite.
  - U: settled by Decision 38 on 2026-10-14.
  - Open from the re-review of commit 9f834234, report under
    `.context/rust-rebuild/review-2026-10-14-rewrite-fix.md`:
  - 1: settled on 2026-10-14; `mokly-frame-adapter.md` carries the Status
    line within its cap.
  - 2: settled by Decision 36 on 2026-10-14.
  - 6: settled on 2026-10-14; the seven lines use the source inventory term
    of the source protection contract and link it.
  - 7: settled on 2026-10-14; the lookup cases feed Rust and browser tests.
  - Open from the review of commit 9a7aa5e2, report under
    `.context/rust-rebuild/review-2026-10-13-nine-decisions.md`:
  - 5: settled on 2026-10-14; the entry props contract excludes a function or
    other non-data value with the `props-not-data` warning, for stories too.
  - Open from the review of commit 1fdf5d95, report under
    `.context/rust-rebuild/review-2026-10-13-shell-delivery.md`:
  - 1 to 6: settled by Decision 27 on 2026-10-14; 7 and 8 by Decision 30.
  - Open from the re-review of commit 62223201, report under
    `.context/rust-rebuild/review-2026-10-13-shell-delivery-fix.md`:
  - 1 and the observation: settled by Decision 30 on 2026-10-14.
  - Open from the review of commit 7cb14ebf, report under
    `.context/rust-rebuild/review-2026-10-14-one-revision.md`:
  - 1, 2, 3, 4, 7, 8, and 9: settled by Decision 30 on 2026-10-14.
  - Open from the review of commit c0f61254, report under
    `.context/rust-rebuild/review-2026-10-14-shell-settled.md`:
  - 2: settled by Decision 34 on 2026-10-14.
  - 4: settled on 2026-10-14; the CSS evidence presentation page reads the
    detail's `rules` and `resources` records only.
  - 9: settled by Decision 36 on 2026-10-14.
  - 11: settled on 2026-10-14; the format inventory page carries the Status
    line.

## Post-merge follow-up (non-blocking)

- [ ] Replace the Intel macOS release runner before GitHub retires its Intel
      images, preserving native build and execution coverage.

- Publish the first 0.x release of the new core: platform packages, viewer,
  then CLI; verify each registry package.
- Reset Mokly Cloud and republish its catalogue with the released CLI.
- Decide on a WebAssembly fallback for platforms without a native package.
