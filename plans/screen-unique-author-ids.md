# Screen-Unique Author Ids

Status: Active. On branch `conductor/screen-unique-author-ids-plan`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

Mokly Cloud (`mokly-ai/mokly-cloud`) will let reviewers pin comments to parts
of a published mockup screen. A comment stores the viewer's `InstanceRef`. Its
`key` is the instance key of the
[instance contract](../docs/protocol/mokly-instances.md). That key hashes the
input owner, the receiving slot, and the local id. So a use gets a new key
when it moves into, out of, or between slots, or under another registered
parent. Its comment then loses its element. Also, only uses of registered
components have keys. Plain elements, such as headings, text, and images,
cannot be picked, so a comment on them attaches only to the whole screen.

This plan adds an opt-in author id. An author writes it on a use of a
registered component or on a plain element. The id is unique in each view of
the screen. Its key ignores the parent and the slot, so a move inside the
entry keeps the key. Mokly records a plain element with an author id like a
component use. It gets a usage record with a 64-hex key, a range, and the
instance markers. Pick, markers, `highlightInstances`, and `scrollToInstance`
then work on it through the `InstanceRef` that hosts already store. The change
raises the entry detail format, so it needs a Mokly release.

Out of scope:

- Point and region annotations. The
  [viewer markers contract](../docs/protocol/mokly-viewer-markers.md) keeps
  them out, as the viewer comment anchoring work of 2026-09-17 did.
- Identity across entries. Design call 2 keeps identity inside one entry.
  Decision 9 asks whether a comment should follow a part to another entry.
- The adoption in Mokly Cloud, which happens in its own repository.
- A command that writes ids into sources. The post-merge section keeps it.

The code changes only after the user approves this plan. Evidence goes under
`.context/screen-unique-author-ids/`.

Contract owners:

- A new page, `docs/protocol/mokly-author-ids.md`, as design call 17 says.
- [Component instance identity](../docs/protocol/mokly-instances.md).
- [Component usage records](../docs/protocol/mokly-component-usage-records.md).
- [Format versions](../docs/protocol/mokly-format-versions.md).
- [Registered components](../docs/protocol/mokly-components.md),
  [HTML screens](../docs/protocol/mokly-html-screens.md), and
  [HTML components](../docs/protocol/mokly-html-components.md).
- [Tree comparison](../docs/protocol/mokly-comparison.md),
  [comparison tree model](../docs/protocol/mokly-comparison-tree.md), and
  [component change attribution](../docs/protocol/mokly-component-changes.md).
- [Published inspector](../docs/protocol/mokly-published-inspector.md),
  [frame adapter](../docs/protocol/mokly-frame-adapter.md), and
  [viewer markers](../docs/protocol/mokly-viewer-markers.md).
- [Component pages and screen inspection](../docs/protocol/mokly-component-explorer.md)
  and [component explorer design](../docs/protocol/mokly-component-design.md).
- [Render sidecar](../docs/protocol/mokly-sidecar.md) and
  [sidecar render records](../docs/protocol/mokly-sidecar-render-records.md).
- The READMEs of `crates/mokly-model`, `crates/mokly-html`,
  `crates/mokly-compare`, `crates/mokly-static`, `packages/mokly`,
  `packages/viewer`, and `packages/ui`.
- The guides under `docs/guides/authoring`, `docs/guides/catalogue/browse.md`,
  and `docs/guides/start/upgrade.md`.

## Terms

- **Author id:** the new opt-in id that an author writes on a use of a
  registered component or on a plain element.
- **Use:** one logical use of a registered component in the render of a view.
  The usage records call it an instance.
- **Plain element:** an HTML element that is not a registered component
  element, such as a heading, a paragraph, or an image.
- **Part:** a use or a plain element that has an author id.
- **Local id:** the `mokly-instance` attribute or the `moklyInstance` prop of a
  use. Its default is the last segment of the component's path.
- **Instance key:** the 64-hex SHA-256 identity of a use in one view.
  `InstanceRef.key` holds it.
- **Author key:** the instance key of a part.
- **Input owner:** the entry or the use whose inputs supply some content. Slot
  content keeps the input owner that supplied it.
- **Entry-owned content:** content whose input owner is the entry. On a
  component's own page, the entry owns the component's body.
- **View:** one viewport and colour scheme of one entry, such as mobile and
  dark of `account/home`.
- **Usage record:** the `usage` of one view in the entry detail. It lists
  `instances`, `slots`, and `ranges`.
- **Range:** one region of nodes between a pair of `mokly-instance` or
  `mokly-slot` comment markers. Its id has the form `r-3`.
- **`InstanceRef`:** the viewer's public reference to a use. It holds
  `screenPath`, an optional `stepIndex`, `viewport`, `colorScheme`, and `key`.
- **Entry detail:** the JSON file of one entry that carries the usage of each
  view. Its format number on `main` is 4.
- **Changes:** the list of entries whose views differ in a way that a reviewer
  should see. The comparison decides this from a canonical form of each view.
- **Moved-entry pairing:** the comparison step of the
  [move contract](../docs/protocol/mokly-moves.md) that pairs an entry that
  left the base with an entry that the current side added.

## User Decisions

The user, Cal, made these two decisions on 2026-11-02 in a Mokly Cloud
brainstorm.

1. **Identity through moves.** "Mokly adds an opt-in id that must be unique in
   the screen. Its key ignores the parent and the slot. A duplicate id fails
   the build. It needs a Mokly release and a new format version." The user
   approved the new build error with this choice.
   - Rejected: change nothing, because slot moves keep breaking comments.
   - Rejected: Mokly Cloud finds a missing key by its local id when exactly
     one use in the view has it. That breaks the `resolveInstance` rule "no
     fallback match by component, local id, …", so the viewer's Changes and
     the cloud can disagree.
2. **Scope.** "Let authors put an id on any element. Mokly records that
   element like a component use, so the viewer and the cloud need no new kind
   of anchor."
   - Rejected: registered components only. Reviewers often comment on copy
     and images, and screens usually draw them as plain elements.

On 2026-11-02 the Mokly Cloud session that started this workspace sent a
correction. It sent it after its own review found that a design call
overstated moved-entry pairing. The correction changed design call 2, added
the limits of moved-entry pairing, and changed the reason for leaving out
catalogue-wide ids. It also asked that any cheap way to cover moves between
entries come as a decision, not as a design call. Decision 9 is that
decision. The user made only the two decisions above.

## Approaches That The Brainstorm Left Out

- Pair moved uses in each comparison, as moved entries pair. Each upload
  compares only with its base, so it cannot follow an element that a pull
  request added.
- Ids unique across the whole catalogue. A shared component appears on many
  screens, so each use would need its own name across the whole catalogue.
- CSS selectors or DOM paths. Any markup edit breaks them, and the viewer
  exposes neither.
- Follow source lines through Git diffs. The cloud may not read repository
  source, and the result is still a guess.
- Point or region pins, and automatic ids for every element. Both depend on
  position, so they lose an element that moves.
- A command that writes ids into the source. It is an add-on to the chosen
  approach, not an alternative. The post-merge section keeps it.

## Requirements From Mokly Cloud

- `InstanceRef` keeps its shape, and `key` stays 64 lowercase hexadecimal
  characters.
- Pick, markers, `highlightInstances`, and `scrollToInstance` work unchanged
  on an element that has an author id.
- The public usage records carry the author id, so that a host can show it
  and match it.
- A use with an unchanged author id keeps its key after a move inside its
  entry. So `resolveInstance` returns `present` or `moved`, never `missing`.
- Mokly Cloud uses only exact-pinned npm releases and documented artifacts.
  It adopts the release in its own pin change. Today it pins `@mokly/mokly`
  0.14.0 and `@mokly/viewer` 0.5.0.

The [format inventory](../docs/protocol/mokly-format-versions.md) states that
Mokly Cloud reads catalogue index 9 and entry detail 4. Those pins predate
both numbers. The item `plans/follow-ups/mokly-cloud-index-v9.md` tracks that
adoption.

## Decisions

Nine decisions are open. They wait for the user. The design calls and the
milestones below follow each recommended option. A milestone TODO names the
decision that it depends on.

Two options checks of the `plans` skill ran on 2026-11-02. The first covered
decisions 1 to 8. It kept every recommendation, and it added options 1 E,
1 F, 1 G, 4 E, 5 D, 6 D, 6 E, and 7 D. It raised the effort of 6 A and 7 A to
Large and corrected facts in seven decisions. The second covered decision 9.
It kept recommendation A, added options E, F, and G, and corrected its text.
The reports are under `.context/screen-unique-author-ids/`.

### 1. How authors write an author id

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-html/src/components.rs`,
  `crates/mokly-html/src/elements.rs`,
  `packages/mokly/src/authoring/components.ts`, and
  `packages/mokly/src/sidecar/plugins.ts`.
- **Terms:**
  - **JSX development shim:** the sidecar's `jsxDEV` wrapper. It sees every
    JSX element that the sidecar compiles, and it adds a source only to Mokly
    wrappers.
  - **React Native Web:** a React DOM library that drops unknown props. It
    writes data attributes only from its `dataSet` prop.
- **Background:** An HTML body names a use with `mokly-instance`. It also
  accepts `mokly-if` and `mokly-viewport` on any element. A React screen names
  a use with the `moklyInstance` wrapper prop. A Storybook story renders the
  consumer's own components, and the same file also runs in Storybook itself.
  Today `mokly-instance` on a plain element passes through as an ordinary
  attribute.
- **Problem:** No input names a plain element, and the author id needs a name
  in every authoring form. Some React components drop props that they do not
  know.
- **Impact if no action:** No implementation milestone can start. The name
  ships in the public authoring API and the guides, so a later rename breaks
  every catalogue that uses it.
- **Root question:** How does an author give a use or a plain element its
  author id in HTML, in React, and in a Storybook story?
- **Options:**
  - **A.** Mokly names, read while rendering. HTML takes `mokly-id` on any
    element, as it takes `mokly-if`. React takes `moklyId` on a wrapper and on
    any JSX element. The JSX development shim removes the prop and marks the
    element's output. `@mokly/mokly` adds `moklyId` to React's JSX types. In
    Storybook itself, React passes the prop to the DOM and warns. Each story
    file needs the Mokly types. Effort: Large.
  - **B.** One data attribute, `data-mokly-id`, in every form. It goes on any
    HTML element or component element, on any React DOM element, and on a
    wrapper. The core finds plain elements in the composed document and
    removes the attribute. Every library that passes data attributes works,
    React Native Web through `dataSet`. A component that drops data
    attributes loses the id without a message. The name joins the reserved
    names that a prop schema cannot declare. Effort: Medium.
  - **C.** One plain attribute, `mokly-id`, in every form, found in the
    composed document as in B. It keeps the `mokly-` family of HTML
    attributes. TypeScript and React accept a hyphenated attribute without
    new types. React Native Web and other libraries that filter props drop
    it, and they have no other way to write it. Effort: Medium.
  - **D.** Wrapper regions. HTML gets a `<mokly-anchor id>` wrapper element
    and React a `MoklyAnchor` component, as `mokly-ignore` and `ReviewIgnore`
    work today. A use takes the id as an attribute or a wrapper prop. A
    region can hold several nodes. Each named part needs an extra wrapper,
    and the id is not on the element. `@mokly/mokly` loads Node modules and
    has no browser entry, so a story that imports `MoklyAnchor` cannot load
    in Storybook itself. Effort: Medium.
  - **E.** B, with one more step in the JSX development shim. It moves a
    `data-mokly-id` that it finds on a component element into a marker pair
    around that element's output. A component that drops data attributes,
    such as a React Native Web view, then keeps the id. The core must then
    read a new marker from sidecar fragments, which design call 8 rules out.
    A part can then hold several nodes or none, so the `element` field needs
    a rule. Effort:
    Large.
  - **F.** B, and the shim also records each `data-mokly-id` on a component
    element. The build warns when that id does not reach the rendered output.
    It finds the loss but does not fix it, and the new warning fails strict
    builds. Effort: Medium.
  - **G.** Two names. A use takes a typed `moklyId` wrapper prop or a
    `mokly-id` attribute on a component element, beside `moklyInstance` and
    `mokly-instance`. A plain element takes `data-mokly-id`. One id then has
    three spellings. The only gain over B is editor completion, because a
    misspelled wrapper prop already fails prop validation. Effort: Medium.
- **Left out:**
  - Other spellings, such as `mokly-anchor` or `mokly-part`, are a detail of
    each option.
  - A CSS selector or a DOM path. The brainstorm rejected it, because a
    markup edit breaks it.
  - The HTML `id` attribute as the author id. It breaks the user's opt-in
    choice, because every existing `id` would record, and an existing
    duplicate `id` would fail the build.
  - An `asChild` form of D, as `MockLink asChild` wraps one child. It is a
    detail of D.
- **Wider fix:** None. The item adds an input. It is not a defect class.
- **Previous examples:**
  - `mokly-instance` and `moklyInstance` name a use in the two forms today.
  - `mokly-ignore` and `ReviewIgnore` mark a region in the two forms.
  - `data-mokly-scroll` is an authored kebab-case data attribute on any
    rendered element, in every form. Mokly does not validate, rewrite, or
    remove it, so under B two `data-mokly-` names have two contracts. Design
    call 9 gives the reason.
- **Related:** Decision 8 sets the grammar of the value and the result of a
  malformed value, whatever this decision chooses.
- **Recommendation:** B. One name works in every form, in Storybook itself,
  and through React Native Web. It needs no shim or type change, and E or F
  can come later without a rename.
- **Action:** ask the user, because the name is a new public authoring input,
  and the options trade portability against the `mokly-` attribute family.

### 2. How a usage record holds a plain element

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-model/src/usage.rs`,
  `packages/viewer/src/generated/catalogue/ComponentInstanceRecord.ts`, and
  `crates/mokly-static/src/inspector.rs`.
- **Background:** Each instance record has a key, a local id, a required
  `componentId`, and an input owner. It also has an optional receiving slot,
  an order, props, a props digest, and an optional source. Used by lists,
  Affected screens, input changes, the Components panel, the labels, and
  `resolveInstance` read these records. About twenty of these readers need a
  registered component. Every reader of entry detail 4 recomputes each
  instance key, so an author key fails every such reader, and the format
  rises in every option.
- **Problem:** A plain element has no component, no props, and no props
  digest. Its record must still carry its key, its author id, and the facts
  that a host needs for a label.
- **Impact if no action:** The format raise cannot be written, and a host
  cannot find the record of a pinned plain element.
- **Root question:** How does the public usage of a view record a plain
  element that has an author id?
- **Options:**
  - **A.** Optional fields in `instances`. A plain element's record omits
    `componentId`, `props`, and `propsKey`, and it adds `element`, its tag
    name. Every record can carry `authorId`. A reader that needs a component
    must handle a missing `componentId`. The Rust compiler and strict
    TypeScript find most such readers, but not an equality test. Effort:
    Medium.
  - **B.** A tagged union in `instances`. Each record gets `kind`, which is
    `component` or `element`. An element record has `kind`, `key`, `authorId`,
    `element`, `owner`, an optional `slotKey`, `order`, and an optional
    `source`. A component record keeps its fields and gains an optional
    `authorId`. An element's range keeps the target kind `instance`, so the
    inspector map writer and both range authenticators need no change. The
    type checks find each reader that must narrow by `kind`. Element orders
    count elements only, so component orders stay the same. Effort: Medium.
  - **C.** A separate `elements` list beside `instances`, with a new range
    target kind, `element`. `instances` keeps meaning component uses, so the
    readers that need a component stay the same. The inspector map writer,
    the detail readers, and the same-origin adapter must learn the new target
    kind. The inspection code, `resolveInstance`, and every host look up a
    key in two lists. Effort: Medium.
- **Left out:**
  - A synthetic registered component for each tag name. B is better on every
    point: it needs the same reader changes without a fake catalogue
    identity.
  - A text excerpt as the host label. It adds consumer text to every detail,
    and the author id already names the part.
  - An additive encoding that readers of detail 4 ignore. An author key on a
    use fails their key check anyway, so the format rises in every case. C is
    then better on every point.
- **Wider fix:** None. The item is a format choice, not a defect class.
- **Previous examples:** `ComponentRangeTarget` is a tagged union with the
  kinds `instance`, `slot`, and `root`.
- **Related:** Decision 7 reads the element's tag name and author id for its
  labels.
- **Recommendation:** B. One list gives hosts and the inspection code one
  place for every key, as the user's scope decision says. Its union also
  makes a record with props but no component impossible, which A cannot do.
- **Action:** ask the user, because the record is a public format, and the
  options trade one list for hosts against fewer changed readers.

### 3. Where an author id must be unique

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:** A screen renders up to four views: mobile and desktop, each
  in light and dark. An HTML body keeps an element in one viewport with
  `mokly-viewport`. A React render receives the viewport and the scheme, and
  it can return a different tree for each. A comment's `InstanceRef` names
  one view.
- **Problem:** The user decided that an author id is unique in the screen and
  that a duplicate fails the build. The decision does not say whether two
  views can use one id on different elements.
- **Impact if no action:** The duplicate check cannot be built. A strict
  reading rejects common responsive markup, such as a mobile heading and a
  desktop heading with one id.
- **Root question:** Where must an author id be unique, so that the build
  fails only on a real clash?
- **Options:**
  - **A.** Unique in each rendered view. Each view of each entry checks its
    own render. One id can name a mobile element and another desktop
    element. The key ignores the view, so a host can match one comment
    across views. One id can then also name unrelated parts in two views,
    and such a host shows a comment on the wrong part. Effort: Small.
  - **B.** Unique in the entry across its views. An id names one source
    element only. HTML checks the body once. React compares the invocation
    source of each view's element. A React render does not always supply
    one, so the check would also reject valid code. A responsive pair needs
    two ids. Effort: Medium.
  - **C.** Unique in each view, and present in every view of the entry. An id
    that some views lack raises a build warning. Viewport-only parts then
    warn, and strict builds fail on them. Effort: Small.
- **Left out:** Unique across the catalogue. The brainstorm rejected it,
  because a shared component appears on many screens, so each use would need
  its own name across the whole catalogue.
- **Wider fix:** None.
- **Previous examples:** Local ids are unique in one input scope of one view
  today. `data-mokly-scroll` names must be unique in one rendered document.
- **Related:** Decision 4 says which content records author ids at all. The
  two rules combine: each view checks only its entry-owned parts.
- **Recommendation:** A. One id then names one logical part in every layout,
  and the build rejects only a real clash. It matches `data-mokly-scroll` and
  HTML `id` values.
- **Action:** ask the user, because A reads "unique in the screen" as "unique
  in each view", which narrows the user's decision of 2026-11-02.

### 4. Author ids in a component's own content

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/viewer/src/shell/frame_instances.ts`.
- **Background:** A component's body, or its React render, can hold plain
  elements and other uses. On a screen, their input owner is the use, not the
  entry. One screen can render one component several times. Pick in a host
  offers only entry-owned uses today. The code sets this rule, and no
  protocol page states it. The Components panel nests the other uses under
  their owner.
- **Problem:** An author id inside a component's own content repeats once for
  each use of the component. A key that ignores the owner then clashes on the
  second use.
- **Impact if no action:** A reused component with an author id in its body
  fails on its second use. Or the plan leaves this content undefined.
- **Root question:** What does an author id mean in content that a use, not
  the entry, owns?
- **Options:**
  - **A.** The key ignores the owner everywhere, as the decision text says. An
    id in a component's content works only while each view renders that
    component once. A second use fails the build as a duplicate. Pick offers
    no such inner part, so it gets no comment unless pick changes. Effort:
    Small.
  - **B.** Only entry-owned content may carry an author id. An author id in
    content that a use owns fails the build, also on a component's own page.
    Effort: Small.
  - **C.** In content that a use owns, the key also hashes the key of that
    use. Elsewhere it ignores the parent and the slot, as decided. An id is
    unique in its owner, the entry or one use. Pick and the Components panel
    also offer these inner parts. An inner part under an owner without an
    author id gets a new key when that owner moves. That breaks the Mokly
    Cloud requirement on moves. Effort: Medium.
  - **D.** Record author ids only in entry-owned content. That content is the
    screen body, a React screen or story render, and the slot content that
    the entry supplies. A component's own page owns its body, so ids there
    work on that page and its variants. On a screen, Mokly removes such an id
    without a message. Pick and the Components panel stay as they are.
    Effort: Small.
  - **E.** C, but only under an owner that has its own author id. The key
    hashes the owner's author key and the inner id, so a move of the owner
    keeps the key. Under an owner without an author id, Mokly removes the
    inner id, as in D. Pick and the Components panel offer these parts.
    Authors must name the owner first. Effort: Medium.
- **Left out:** Positional suffixes for repeated inner ids. The instance
  contract forbids them, because a reorder would change the keys.
- **Wider fix:** None.
- **Previous examples:** Local ids are already scoped to their input owner,
  and pick offers only entry-owned keys.
- **Related:** Decision 3 sets the view scope. Decision 1 sets the input.
  Decision 8 B warns only in content that records the id, as design call 24
  says.
- **Recommendation:** D. It keeps the decided key, fails nothing new, and
  matches pick, which offers only entry-owned parts. A later move to E stays
  additive, because the keys of entry-owned parts do not change.
- **Action:** ask the user, because each option limits or extends where the
  user's decision of 2026-11-02 applies.

### 5. How the author id relates to the local id

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-html/src/components.rs` and
  `packages/mokly/src/authoring/components.ts`.
- **Background:** Every use has a local id. Local ids are unique in one input
  scope, so two buttons in one scope need two `mokly-instance` values today.
  The comparison and the labels use the local id. The brainstorm made the
  author id a separate input, so existing keys stay the same.
- **Problem:** A use can now carry two ids. The plan must say which local id
  such a use has, and whether both ids can appear on it.
- **Impact if no action:** The record of a use with an author id, its label,
  and its duplicate check cannot be built.
- **Root question:** Which local id does a use with an author id carry, and
  can it also carry an explicit local id?
- **Options:**
  - **A.** Independent ids. The local id keeps its meaning and its default.
    The author id is a second, optional id, and the key uses it when present.
    Two uses in one scope still need distinct local ids, as today. Effort:
    Small.
  - **B.** The author id is the default local id. Without `mokly-instance`, a
    use with an author id takes the author id as its local id. An explicit
    local id still wins. One attribute then names most uses, but adding an
    author id can change a use's local id. Effort: Small.
  - **C.** The author id replaces the local id. A use carries only one of the
    two, and both together fail the build. The record's local id is the
    author id. Effort: Small.
  - **D.** Independent ids, and two uses in one scope can share a local id
    when their author ids differ. Two new uses of one component then need
    only their author ids. This relaxes the duplicate rule of the instance
    contract, and two labels can read the same. The keys that decision 6 A
    derives from local ids then collide, so 6 A needs a tie-breaker.
    Effort: Medium.
- **Left out:** None.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** Decision 6. Its option A keeps id-only edits out of Changes
  only with option A here. Options B and C change the local id, which the
  comparison compares, and D makes the derived keys collide.
- **Recommendation:** A. It keeps every existing identity, label, and
  duplicate rule, and decision 6 A depends on it.
- **Action:** ask the user, because B saves an attribute on new screens while
  A keeps the local id stable, and neither is clearly best.

### 6. Whether an id-only edit appears in Changes

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-compare/src/material_nodes.rs`,
  `view_material.rs`, `instance_impact.rs`, `instance_proof.rs`,
  `owned_style_instances.rs`, and `projection_inputs.rs`.
- **Background:** Inside a use's range, the canonical form of a view keeps the
  use's key, component path, local id, and props digest. The keys of a use's
  slots, and of the uses inside them, derive from the use's key. Today a local
  id edit is a material change. A plain element's content compares as
  ordinary content, and the canonical form drops every marker. Uses pair
  across the two sides by owner, scoped instance id, and component path.
- **Problem:** An author id changes the key of its use. Adding one to a use
  therefore changes the canonical form, also for the uses in its slots,
  although the page looks the same.
- **Impact if no action:** A pull request that only adds author ids lists each
  touched screen in Changes. Mokly Cloud then shows equal before and after
  views as changed.
- **Root question:** Should an edit that only adds, renames, or removes author
  ids list the screen in Changes?
- **Options:**
  - **A.** Never. The comparison identifies each use by the key that it would
    have without author ids. It derives that key from the usage records, so
    an id-only edit leaves every view unchanged. Several readers in
    `crates/mokly-compare` pair by the raw key today, and each must change.
    Effort: Large.
  - **B.** Only for uses. Their key stays in the canonical form, as a local id
    edit counts today. A plain element's id stays out of the comparison. An
    entry that moves and gains ids in one change then loses the
    identical-content signal of moved-entry pairing. Effort: Small.
  - **C.** Always. The canonical form also records each plain element's author
    id, so every id edit lists the screen. It loses the same move signal as
    B. Effort: Small.
  - **D.** Only a removal or a rename of an author id lists the screen, with a
    new reason that names the lost id. Adding an id lists nothing. It needs
    the work of A, a new Changes reason with its copy, and a new reason kind
    in entry detail 5. Mokly Cloud already sees a lost key through
    `resolveInstance`. Effort: Large.
  - **E.** Composition and the comparison keep today's instance keys. Each
    record carries the author id beside its key. The core writes the author
    key, and the keys that derive from it, only into public output. That
    output is the entry detail, the served markers, the inspector map, and
    the workspace lists. The comparison then needs no change. One record type
    then carries two sets of keys. A public writer that forgets to map them
    gives hosts a key that changes on a move. Effort: Large.
- **Left out:** Public records that carry both keys, with the author key in
  `InstanceRef.key`. A moved use then gets a new record `key`, which breaks
  the Mokly Cloud requirement that the use keeps its key.
- **Wider fix:** None.
- **Previous examples:** The optional source location of a use never enters
  keys or Changes.
- **Related:** Decision 5. Option A here holds fully only with its option A.
  Design call 4 causes most of the work of A, and E keeps that work out of
  the comparison.
- **Recommendation:** A. Changes then lists only what a reviewer can see, and
  adding ids before a review lists nothing. It keeps the documented rule that
  uses pair by owner, scoped instance id, and component path, which B and C
  break.
- **Action:** ask the user, because the options change which edits Changes
  lists, and no requirement covers author ids.

### 7. How the Browse shell shows author ids

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/ui/src/instance-tree/instance-tree.tsx`,
  `packages/ui/src/props-panel/props-panel.tsx`, and
  `packages/viewer/src/shell/workspace_inspection_labels.tsx`.
- **Terms:**
  - **Highlight components:** the view toolbar switch that dims the screen and
    outlines each use with a label.
- **Background:** The screen inspector's Components panel lists the uses of a
  view by owner. Selecting one opens Props. Highlight components labels each
  use as `Component · id`. A host's pick draws the same mask and labels.
  Hosts render the same panel. The Components list gives keyboard users a
  way to select each part without a pointer.
- **Problem:** A plain element has no component title, no props, and no
  component page. The shell has no row and no label for it.
- **Impact if no action:** Pick has no label for a plain element, and authors
  cannot check their ids in Serve.
- **Root question:** How do authors and reviewers see a part that has an
  author id in the Browse shell?
- **Options:**
  - **A.** As a use. The Components panel lists each plain element under its
    owner. Its row and its label show the author id and a plain element kind,
    such as Heading. Highlight components outlines it. A use with an author
    id shows that id in its label. Milestone 1 settles the words on a
    five-screen mockup page. Effort: Large.
  - **B.** Host only. The standalone shell keeps listing and highlighting
    registered components only. A plain element appears only in host pick,
    markers, and host highlights, with a label. Authors cannot see their ids
    in Serve. Without a row, a keyboard user cannot select a plain element,
    which breaks the keyboard rule of the screen inspection contract. Effort:
    Small.
  - **C.** A separate list. The inspector gets a list of named parts, both
    elements and uses, and Highlight components stays for components.
    Selecting a named part highlights it. Effort: Large.
  - **D.** As A for plain elements. A use with an author id keeps its
    `Component · id` label, and Props shows its author id. The label rule of
    the viewer markers contract then stays. A reviewer sees the author id of
    a use only after selecting it. Effort: Medium.
- **Left out:** A highlight for a plain element that has no row in the
  Components panel. It breaks the rule that a reader can select every part
  through the Components list, without a pointer.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** Decision 2 supplies the tag name and the author id for the
  labels. Decision 5 A gives a use two ids, and milestone 1 settles the one
  label form.
- **Recommendation:** A. Authors can check every id where they work, and the
  same list gives keyboard users a path to each part.
- **Action:** ask the user, because each option changes what the shell shows,
  beyond the current contract.

### 8. A malformed author id

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:** An explicit local id uses lowercase kebab-case, and a
  malformed value fails the build. The always-on rules prefer a warning when
  input is recoverable. A duplicate author id fails the build, as the user
  decided, because two parts would claim one key.
- **Problem:** The author id needs a grammar and a result for a value outside
  it.
- **Impact if no action:** Readers cannot validate `authorId`, and authors get
  no rule for a valid id.
- **Root question:** Which values can an author id take, and what happens to a
  value outside them?
- **Options:**
  - **A.** The kebab-case grammar `^[a-z0-9]+(?:-[a-z0-9]+)*$`, which
    `data-mokly-scroll` uses. A malformed value fails the build and names the
    file, the line, and the column when they are known. Effort: Small.
  - **B.** The same grammar. A malformed value raises a build warning, and the
    part gets no author id. Serve keeps working, and strict builds fail.
    Effort: Small.
  - **C.** Any text of 1 to 128 characters without control characters. Only
    an empty or a longer value fails the build. Two spellings that differ only
    in case are two ids. Effort: Small.
- **Left out:**
  - The local id grammar. It also rejects Windows device names such as `con`,
    because a local id must be a path segment. An author id has no reason for
    that rule.
  - A silent drop, as a malformed `data-mokly-scroll` name acts as no name.
    It breaks the always-on rule to warn and continue on recoverable input.
  - A repair, such as lowercasing. The stored id would then differ from the
    text that the author wrote and that a host shows.
- **Wider fix:** None.
- **Previous examples:**
  - `invalid component instance id` in `crates/mokly-html/src/components.rs`.
  - An invalid ignore id fails with `html-element`.
  - `ReviewIgnore` throws on a malformed id.
- **Related:** Decision 4 D. The check runs only in content that records the
  id, so a reused component does not repeat the warning on each screen.
- **Recommendation:** B. A dropped id is recoverable, so the graceful-handling
  rule applies, and strict builds still stop it in CI.
- **Action:** ask the user, because each option adds a new warning or a new
  build error.

### 9. Moves of a part between entries

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** None.
- **Background:** Design call 2 keeps identity inside one entry and lists the
  limits of moved-entry pairing. An author key ignores the entry path, so a
  part keeps its key when it moves to another entry. The catalogue delivery
  contract publishes no authored move hint today, and the Mokly Cloud
  receiver reads no entry detail. Mokly Cloud does not ask this plan to cover
  moves between entries.
- **Problem:** A part loses its comments when it moves to another entry and
  its old entry stays. This holds also when the new entry is new, because a
  pair needs a removed base entry. Neither the key rules nor moved-entry
  pairing can follow such a part.
- **Impact if no action:** Comments on such a part lose their element, as
  comments on a removed part do. A reviewer must pin them again.
- **Root question:** How can a comment follow a part that an author moves to
  another entry?
- **Options:**
  - **A.** Change nothing. Identity stays inside one entry, and such a comment
    loses its element. Every other option can come later as an optional
    field or a host rule, without a new format number. Effort: Small.
  - **B.** A declared part move. The author writes the previous entry path on
    the moved part, as `movedFrom` declares an entry move. The record carries
    that path, which publishes an authored move hint for the first time. A
    host then moves only the comments whose key the named entry no longer
    has. The named entry still exists, so a kept declaration can later move
    the comments of a new part that reuses the id. The host must read every
    entry detail. A pull request entry that was renamed between pushes needs
    a declaration on each part. Effort: Medium.
  - **C.** Opt-in catalogue-unique ids. An author marks an author id as unique
    across the catalogue, and the build fails when a second entry uses it. A
    host may then search every entry for such a key. This changes the rule
    "never search another entry" for marked ids. A variant renders its
    parent's render, so a marked id needs a variant rule. The check spans
    entries, but each usage check today runs inside one render. Effort:
    Large.
  - **D.** The comparison pairs parts across entries. When a part with a
    unique author id leaves one entry and appears in another, the comparison
    records a part move. It has the limits of moved-entry pairing, so it
    cannot follow a part that a pull request added. A part move belongs to
    one view, and the index carries no per-view usage, so it needs the
    detail or a rule change. Effort: Large.
  - **E.** A declared source on the receiving entry. A new optional
    definition field, next to `movedFrom`, names the entries that this entry
    took parts from, and the index carries the list. A host moves a comment
    only when the named entry's view lost the key and the same view of the
    declaring entry has it. One line covers a merge, a split, and a pull
    request entry that was renamed between pushes. It publishes an authored
    move hint, two declaring entries with one key leave the host unable to
    choose, and variants need a mapping by slug. Effort: Medium.
  - **F.** A pairing rule that the host runs between two of its own uploads.
    The instance contract defines it, and `@mokly/viewer` exports it as a
    pure function, as it exports `resolveInstance`. It pairs a key that left
    exactly one entry with the same key that appeared in exactly one other
    entry, in the same view. It also follows a part that a pull request
    added. The host must read every detail of both uploads, and one push can
    remove `title` from one screen and add a different `title` to another.
    Effort: Medium.
  - **G.** A suggestion that a reviewer confirms. The rule "never search
    another entry" stays for automatic resolution. The contract lets a host
    show the entries whose same view has the missing author key, and a
    reviewer confirms the move. Mokly Cloud builds the search and the prompt,
    and it must read the details. Effort: Small.
- **Left out:**
  - An automatic host search for a missing key. Author ids are unique only in
    one view, and ids such as `title` repeat across screens. So the search can
    move a comment to a different part. The user also rejected a guessing
    fallback on 2026-11-02. G brings the search back with a reviewer's
    confirmation.
  - A comparison diagnostic that says an author id left one entry and
    appeared in another. It moves no comment, so it does not meet the goal
    alone. It can be a hint inside B or D.
- **Wider fix:** None. The item is a design question, not a defect class.
- **Previous examples:** Entry `movedFrom` declares an entry move under the
  move contract.
- **Related:** Decision 1 sets the input that B, C, and E extend. Decision 2
  sets the record that B extends. Decision 3 sets the per-view scope that C
  widens. Decision 4 D records ids on variants, which C, D, and E must handle.
- **Recommendation:** A. Mokly Cloud does not ask for this, and every other
  option can come later without a new format number. If the user wants cover
  now, G is the cheapest option, and E is the automatic option with the least
  author and host work.
- **Action:** ask the user, because each option except A adds behaviour that
  no requirement covers, so the plan raises this cover for the user.

## Design Calls

Calls 1 and 2 come from the brainstorm of 2026-11-02. They are not user
decisions. The Mokly Cloud session's correction of 2026-11-02 set the text of
call 2. Each other call is the orchestrator's own, made on 2026-11-02. A call
that rests on an open decision follows its recommended option.

1. **Separate id.** The author id is separate from `moklyInstance` and
   `mokly-instance`. Those keep their meaning, so existing keys do not change.
   Decision 5 asks how the two ids relate on one use.
2. **One entry.** Identity stays inside one entry. Reason: keys are unique
   only within one view of an entry, and `docs/protocol/mokly-instances.md`
   says never to search another entry for a missing key. The moved-entry
   pairing of `docs/protocol/mokly-moves.md` has these limits:
   - Moved-entry pairing runs once per comparison, against the base of that
     comparison. A pair joins an entry that left the base with an entry that
     the current side added.
   - It pairs only by an authored `movedFrom`, by identical content, or by the
     same source file and title. It never pairs an ambiguous match. A build
     without a comparison has no pairs.
   - So a host cannot follow an element that moves to another entry that
     still exists. It also cannot follow an entry that a pull request added
     and then renamed between pushes, or an edited entry whose file moved
     without `movedFrom`.
3. **Author key.** The key is the same SHA-256 digest of UTF-8 JSON as the
   instance key, over `["mokly-author-v1", authorId]`. The domain string is a
   permanent identifier. With decision 4 C or E, the owner's key comes before
   the id. Reason: the user decided that the key ignores the parent and the
   slot, and a new domain string cannot collide with an instance key.
4. **Slot and nested keys.** A use's slot keys keep deriving from its record
   key. So an author id on a container changes the keys of the uses in its
   slots that have no author id. The stability rule of the instance contract
   already says so for an ancestor key change. Reason: one key per use keeps
   every reference in the records simple. This call causes most of the work
   of decision 6 A.
5. **One namespace.** A use and a plain element with the same author id in
   one view clash. Reason: both keys use one preimage.
6. **Repeated placements.** Slot content that a component places several
   times is one part with one record and several ranges, as a use is today.
   Any other repeat is a duplicate.
7. **Own region kind.** A plain element's range is a new region kind of the
   composed tree. It is an inspection region only. It owns no input, style
   rule, resource, link base, or Changes evidence, and its content keeps its
   owner. Reason: an instance region hides its content from the entry's
   comparison and claims styles, resources, and relative links.
8. **Markers.** A plain element's range uses the `mokly-instance` comment pair
   with `instance` and an `element` attribute, and no `path` or `props`. The
   inspector and the adapters authenticate only `id` and `instance`, so they
   need no new marker kind, and the inspector map keeps its shape. The core
   never reads such a marker from a sidecar fragment.
9. **Attribute removal.** The core removes the author id attribute from every
   composed document. This includes pages, documents, `template` contents,
   and ids that record nothing. Reason: authored styles and comparison must
   not depend on it. `data-mokly-scroll` stays in the output, because it is
   consumer metadata that Mokly does not read. The author id is Mokly input,
   and the markers carry it instead. The new protocol page says so.
10. **Pages and documents.** They have no usage, so an author id there records
    nothing and raises no diagnostic.
11. **Unrendered content.** An element that `mokly-if`, `mokly-viewport`, or a
    React condition removes has no record, as an unrendered use has none.
12. **HTML repair.** When the HTML parser moves a plain element with an author
    id, its range follows the repair rules of an instance range.
13. **Ignore regions.** A plain element's range may lie inside an ignore
    region or hold one. Reason: it carries no comparison signal.
14. **Record fields.** `element` is the element's lowercase local name.
    `source` is present when the HTML driver knows the start tag's location.
    React plain elements omit it.
15. **Limits.** Author keys and their ranges count toward the inspector limits
    of 1,024 keys and 4,096 ranges in one mount. An overflow reports `limit`,
    as today.
16. **Resolution and pick.** `resolveInstance` keeps its rule. An element
    record has no props digest on either side, so the order and the slot
    decide between `present` and `moved`. Pick keeps offering entry-owned
    keys. With decision 4 D every author key is entry-owned, so pick needs no
    change. Under 4 A, C, or E, pick must change before inner parts can get
    comments.
17. **New protocol page.** `docs/protocol/mokly-author-ids.md` holds the author
    id contract, and the other pages link to it. Reason: the rules span every
    authoring form, and `mokly-html-screens.md` has 247 of its 250 lines.
18. **Format numbers.** Release 0.18.0 shipped entry detail 4, so this change
    raises it to 5. The type becomes `EntryDetailV5`, and the fixture becomes
    `docs/protocol/fixtures/entry-details-v5.json`, as each earlier raise
    renamed them. The index stays 9, the inspector wire stays 2, and the
    upload metadata and the live descriptor keep their numbers. The inspector
    map keeps its shape. If `origin/main` raises the detail number before
    this branch merges, this change keeps that number and adds its shape.
19. **Status lines.** Each protocol page and README that milestone 2 changes
    gets the repository's status line, linked to this plan. Milestone 12
    removes them. The guides carry no status line, so milestone 11 changes
    them after the implementation.
20. **Mockup page.** The artboards go on a new child page,
    `components/inspection/author-ids`, under Screen inspection. Reason:
    Screen inspection already renders five screens.
21. **Example catalogue after the implementation.** Milestone 10 adds author
    ids to the example catalogue after the core reads them. Reason: a
    component element or a wrapper with an author id fails the build until
    then. Milestone 1 needs no implementation. Precedent: design call 2 of the
    shared UI shell views plan.
22. **Tests.** Each requirement gets one test at the lowest level that fails
    without the change. Each code path that reads an author id gets its own
    case: the HTML engine, the React wrapper, and the composed-document pass.
    Browser specs cover only frames: pick, markers, highlights, scrolling,
    and the inspector panel. Each new browser case runs 10 times before the
    commit.
23. **Release and adoption.** The npm release needs the user and the release
    credentials, and Mokly Cloud adopts it in its own repository. Both are
    post-merge tasks.
24. **Where the grammar check runs.** With decisions 4 D and 8 B, the check
    runs only in content that records the id. So a reused component does not
    repeat the warning on each screen. An HTML value that uses `{{name}}` is
    known only after substitution, so its check runs at render.
25. **Input changes.** The input changes of a detail first pair a use by its
    author key, when both sides carry the same author id. Otherwise they pair
    it by the key of decision 6 A. Reason: each key alone loses one case, a
    moved use with new props or an id added with new props.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Show author ids in the screen inspection designs, as decision 7 A proposes.
Each artboard has a mobile and a desktop variant. With decision 7 B, the page
shows only the label that host pick draws. With 7 C, it shows the named-parts
list instead. With 7 D, uses keep their `Component · id` label.

- [ ] Give the synthetic Welcome fixture a plain heading with the author id
      `welcome-title`, and give one Action use an author id. The fixtures are
      under `examples/basic/specs/design/components/parts/`.
- [ ] Add the page
      `examples/basic/specs/design/components/inspection/author-ids/` with at
      most five screens:
  - [ ] The Components panel with the plain element and the use.
  - [ ] Highlight components with the element's label.
  - [ ] The selected plain element: its author id and element kind, without
        props.
  - [ ] The selected use with its author id.
  - [ ] A view whose only parts are plain elements, so that the panel and the
        switch show their copy for that case.
- [ ] Link the page from the Screen inspection page.
- [ ] Settle these words under the copy rules of the `product-ui` skill:
  - [ ] the element kind names
  - [ ] the label of a use with two ids
  - [ ] the count line and the switch name
- [ ] Run the mockup check named in `AGENTS.md`. Smoke-test the changed pages
      through `npm run dev`. Save the evidence under
      `.context/screen-unique-author-ids/`.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show. Add a decision when the decision test says so.

## Milestone 2: Documentation and protocol

Depends on: 1

State the requirements and the decisions in force, so that each later
milestone and its review can check the code against them. Each page keeps the
250-line cap of `AGENTS.md`.

- [ ] Write `docs/protocol/mokly-author-ids.md`. It states:
  - [ ] the input of decision 1 and the grammar of decision 8
  - [ ] the scopes of decisions 3 and 4, and the local id of decision 5
  - [ ] the key of design call 3 and the records of decision 2
  - [ ] the ranges and markers of design calls 7 and 8
  - [ ] the Changes rule of decision 6
  - [ ] the cases of design calls 9 to 15, with the reason why the author id
        leaves the output and `data-mokly-scroll` stays
- [ ] List the new page under Authoring in `docs/protocol/README.md`.
- [ ] `docs/protocol/mokly-instances.md`: identity covers a plain element with
      an author id. Add the author key, the stability rule for a move inside
      the entry, and the resolution of an element record.
- [ ] `docs/protocol/mokly-component-usage-records.md`: the record shape of
      decision 2, its validation, and the order of each kind.
- [ ] `docs/protocol/mokly-components.md`, `mokly-html-screens.md`, and
      `mokly-html-components.md`: the reserved attribute or prop and a link to
      the new page. Keep `mokly-html-screens.md` within 250 lines.
- [ ] `docs/protocol/mokly-comparison.md`: the marker of design call 8.
      `mokly-comparison-tree.md`: a plain element's range owns nothing.
      `mokly-component-changes.md`: the Changes rule of decision 6.
- [ ] `docs/protocol/mokly-published-inspector.md`,
      `mokly-frame-adapter.md`, and `mokly-viewer-markers.md`: ranges,
      boundaries, and markers include plain elements with author ids. Point
      and region annotations stay out.
- [ ] `docs/protocol/mokly-component-explorer.md` and
      `mokly-component-design.md`: decision 7 and the mockups of milestone 1.
- [ ] `docs/protocol/mokly-sidecar.md` and
      `mokly-sidecar-render-records.md`: a wrapper removes the author id, and
      an instance draft carries it.
- [ ] `docs/protocol/mokly-format-versions.md`: entry detail 5 and its reason.
      Milestone 3 changes the type links, because the link check needs the
      new type file.
- [ ] Add the status lines of design call 19.

## Milestone 3: Entry detail 5 and the record shape

Depends on: 2

Raise the format and give the records the shape of decision 2. No author id
exists yet, so every record is a component use, and the product keeps working.

- [ ] `crates/mokly-model`:
  - [ ] the record union of decision 2, with `authorId`
  - [ ] `ENTRY_DETAIL` 5 in `versions.rs`
  - [ ] the author key function of design call 3, beside `instance_key` in
        `material.rs`
- [ ] Rename `EntryDetailV4` to `EntryDetailV5` in the code, the tests, and
      the docs. Rename the protocol fixture. Run `cargo xtask generate-types`.
- [ ] Update the type links of `mokly-comparison.md`,
      `mokly-catalogue-serialization.md`, `mokly-shell-delivery.md`, and
      `mokly-viewer-api.md`.
- [ ] Rust validation in `usage_context.rs`, `usage_references.rs`,
      `usage_schemas.rs`, and `detail_validation.rs`: an author key must match
      its author id. An element record names a valid tag and receives no slot.
      Orders are contiguous for each kind.
- [ ] Narrow each Rust reader that needs a component by `kind`. Examples are
      the Used by projection, the affected evidence, the input changes, and
      the numeric warnings.
- [ ] `packages/viewer`: the detail reader gate 5, `readInstance` for both
      kinds, `view_validation.ts`, `view_references.ts`, the author key in
      `keys.ts`, the detail fences, and `live_render.ts`. Narrow the shell
      readers by `kind` without a visible change.
- [ ] Tests: the detail reader rejects version 4. Validation accepts an element
      record and rejects a wrong author key and an element that receives a
      slot. Update `tests/generated_wire_versions.test.ts`.
- [ ] Update the Key Code of the `mokly-model` and viewer READMEs.

## Milestone 4: Author ids on HTML component uses

Depends on: 3

- [ ] `crates/mokly-html/src/components.rs`: read the author id on a component
      element as a reserved attribute that never reaches props. Compute the
      author key in entry-owned content, and remove the id elsewhere, as
      decision 4 D says. Keep the local id of decision 5 A.
- [ ] Check duplicates in each view under decision 3 A, with repeated
      placements as design call 6 says. Report a malformed value under
      decision 8 B and design call 24.
- [ ] `crates/mokly-catalogue/src/props.rs`: reserve both spellings of the
      name. The HTML component element form is `dataMoklyId`, and the wrapper
      form is `data-mokly-id`.
- [ ] Tests:
  - [ ] A use keeps its author key after it moves into a slot.
  - [ ] A duplicate in one view fails and names the id.
  - [ ] One id on a mobile-only and on a desktop-only element passes.
  - [ ] A malformed id warns and records nothing.
  - [ ] An id in a component body records nothing on a screen and records on
        the component's page.
- [ ] Update the Key Code of the `mokly-html` README.

## Milestone 5: Author ids on React wrappers and in stories

Depends on: 4

- [ ] `packages/mokly/src/authoring/components.ts`: remove the author id with
      `moklyInstance` and `__moklySource`. Compute the author key in
      entry-owned content, and check duplicates in the render session.
- [ ] `InstanceDraft` in `crates/mokly-sidecar/src/usage.rs` carries the author
      id. `crates/mokly-render/src/fragments.rs` maps it, and
      `crates/mokly-html/src/fragment_validation.rs` checks the author key.
- [ ] Add a story fixture under `tests/fixtures/sidecar` whose render uses a
      wrapper with an author id.
- [ ] Tests: a wrapper keeps its author key after it moves into a slot. A
      duplicate fails. The story records the author key.
- [ ] Update the `packages/mokly` README.

## Milestone 6: Plain elements in the composed document

Depends on: 4

Record plain elements with an author id in every screen and component view,
whatever rendered them.

- [ ] Add the region kind of design call 7 and its marker of design call 8.
- [ ] After composition, find the author id on each plain element. Take the
      input owner and the slot from the enclosing ranges. Record entry-owned
      elements with their range, and remove the attribute everywhere.
- [ ] Apply the duplicate, repeat, page, repair, and ignore rules of design
      calls 5, 6, 10, 12, and 13.
- [ ] Keep the new region out of these parts of `mokly-compare` and
      `mokly-graph`:
  - [ ] the material form and the CSS containment
  - [ ] the resource owners and the link bases
  - [ ] the capture codec and the memory accounting
- [ ] Tests:
  - [ ] An HTML heading and a React DOM element with an author id each get a
        record, a range, and a marker.
  - [ ] A text edit inside the heading still changes the screen.
  - [ ] A CSS rule that matches inside the heading stays the entry's.
  - [ ] The inspector map of `crates/mokly-static/src/inspector.rs` holds the
        heading's range with its key.
- [ ] Update the READMEs of the changed crates.

## Milestone 7: Changes ignores author ids

Depends on: 4

Apply decision 6 A. With 6 B, drop this milestone. With 6 C, record each plain
element's author id in the material form instead. With 6 E, the core keeps
today's keys and maps author keys in every public writer instead.

- [ ] `crates/mokly-compare`: derive from the usage records the key that each
      use would have without author ids. Pair and compare uses, slots, and
      slot signals by it in `material_nodes.rs`, `view_material.rs`,
      `instance_impact.rs`, `instance_proof.rs`, and
      `owned_style_instances.rs`.
- [ ] `projection_inputs.rs`: pair input changes under design call 25.
- [ ] Tests:
  - [ ] Adding an author id to a use with slot content leaves every view
        unchanged.
  - [ ] Moving a use with an author id into a slot is still a change.
  - [ ] An id-only edit adds no input change.
  - [ ] A moved use with new props, and an id added with new props, each
        report an input change.
- [ ] Update the `mokly-compare` README.

## Milestone 8: Viewer runtime

Depends on: 6

- [ ] `resolveInstance` resolves an element record under design call 16.
- [ ] Markers, `highlightInstances`, `scrollToInstance`, hover, click, and
      pick accept the key of a plain element.
- [ ] Browser specs: add a plain element with an author id to the viewer
      harness fixture. Add one case to each of these specs:
  - [ ] `viewer_markers_states.spec.ts`
  - [ ] `viewer_multi_highlight.spec.ts`
  - [ ] `viewer_events.spec.ts`
  - [ ] `frame_adapter.spec.ts`, cross-origin, so that the in-frame inspector
        authenticates the element's range
- [ ] Run each new browser case 10 times. Save the counts under
      `.context/screen-unique-author-ids/`.
- [ ] Update the viewer README.

## Milestone 9: The shell shows author ids

Tags: ui

Depends on: 1, 8

Build what milestone 1 shows, under decision 7 A.

- [ ] `@mokly/ui`: the instance tree, the props panel, and the highlight label
      show a plain element and the author id of a use. Update the package
      tests.
- [ ] Viewer containers: `workspace_instances.tsx`, `workspace_props.tsx`,
      `workspace_inspection_labels.tsx`, `viewer/inspection_layer.tsx`, and
      `workspace_inspection_runtime.ts`.
- [ ] Browser spec: one case in `component_explorer_inspection.spec.ts` lists
      and selects a plain element. Run it 10 times.
- [ ] Compare the shell with the mockups of milestone 1. Update the
      `packages/ui` README.

## Milestone 10: Example catalogue

Tags: mockup

Depends on: 5, 6, 9

- [ ] Add author ids to a plain element and a use in each of these places:
  - [ ] `examples/basic/specs/example/team/invite.screen.html`
  - [ ] a React screen under `examples/basic/specs/example/screens`
  - [ ] an HTML component body under `examples/basic/src/components`
- [ ] Run the mockup check named in `AGENTS.md`. Smoke-test the pages through
      `npm run dev`: the panel lists the ids, and the highlight labels them.

## Milestone 11: Guides and upgrade notes

Depends on: 4, 5, 6, 9

- [ ] `docs/guides/authoring/screens.md`, `components.md`, and
      `storybook.md`: how to write an author id, where it counts, and its
      uniqueness. Show the React Native Web `dataSet` form.
- [ ] `docs/guides/catalogue/browse.md`: the inspector shows author ids.
- [ ] `docs/guides/start/upgrade.md`: entry detail 5. Hosts rebuild and
      republish each catalogue with the matching viewer.

## Milestone 12: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Remove the status lines of design call 19.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request with a `feat!:` title. Its description has a
      `BREAKING CHANGE:` footer for entry detail 5 and `EntryDetailV5`.
- [ ] The description gives the decisions and the design calls of this plan
      with their dates and a permalink to this plan. It also lists the
      follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Release the packages with entry detail 5. Merge the Release Please pull
      request, and let the release workflow publish `@mokly/mokly`,
      `@mokly/viewer`, `@mokly/ui`, and the native packages. This needs the
      user and the release credentials.
- [ ] Mokly Cloud adopts the release in its own pin change. It reads entry
      detail 5, stores `InstanceRef` as before, and reads `authorId` to show
      and match a pinned part. It first needs the earlier raises that
      `plans/follow-ups/mokly-cloud-index-v9.md` tracks.
- [ ] Consider a command that writes author ids into the sources. It is an
      add-on to this approach and needs its own brainstorm.
