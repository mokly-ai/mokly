# Saved slots skip the duplicate navigation check

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`, found by its
  README delegate on 2026-10-29.
- **Location:** `crates/mokly-html/src/source_locations.rs:15-20`, where a
  saved slot gets no check, and lines 10-13 of that file, where a body gets
  it. The requirement is at `docs/protocol/mokly-link-validation.md:22-23`.
- **Reason:** On 2026-11-01 the diagnostics branch left this choice to the
  user, because each option adds a build error or changes a requirement.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Navigation attribute:** `href`, `data-nav-href`, `data-mokly-link`,
    `data-mokly-target`, or an attribute whose name starts with
    `data-mokly-link-control`.
  - **Saved slot:** an HTML fragment that a saved component variant supplies
    for a declared slot, under `slots` in its front matter.
  - **Callback output:** the HTML that a JavaScript render callback returns
    through the render sidecar.
  - **Composition:** the `mokly-html` step that renders a view of an entry
    from its body, its components, and its slots.
- **Background:**
  - `docs/protocol/mokly-link-validation.md:22-23` says that an authored
    reserved marker and a duplicate navigation attribute fail validation.
  - The HTML parser keeps only the first of two attributes with one name. So
    the check reads the HTML tokens before the parse.
    `source_checks::validate` in `crates/mokly-html/src/source_checks.rs`
    does this.
  - Composition runs `source_checks::validate` on each body, in
    `source_locations::template` at
    `crates/mokly-html/src/source_locations.rs:10-13`. It also runs it on
    callback output, at `crates/mokly-html/src/javascript.rs:130`.
  - `source_locations::slot` at lines 15-20 parses a saved slot without
    this check. Catalogue validation does not check duplicate attributes.
  - The same function also rejects each start tag with a reserved navigation
    name, `data-mokly-link` or a `data-mokly-link-control` name. In a saved
    slot, such a name only warns today.
- **Problem:** A saved slot that repeats a navigation attribute builds
  without a message. Probes on 2026-10-29 and 2026-11-01 gave these
  results:
  - A saved slot with
    `<a href='https://a.example' href='https://b.example'>t</a>` builds with
    exit 0 and no message. The output keeps only the first `href`.
  - The same element in a component body fails with
    `duplicate navigation attribute href`. The failure names the document
    route, not the file or the line.
- **Impact if no action:** An author who writes two link targets in a saved
  slot gets the first one without a message. The code does not meet the
  link validation requirement.
- **Root question:** Where should saved-slot HTML get its duplicate
  navigation check?
- **Options:**
  - **A.** Run the source checks on each saved slot during composition, as
    for bodies. This adds a build error. Run unchanged, the check also fails
    reserved navigation names in saved slots, which only warn today. Effort:
    Small.
  - **C.** State in `docs/protocol/mokly-link-validation.md` that saved
    slots skip the check. This changes the requirement. Effort: Small.
  - **B.** Put the check into the shared validation of authored HTML that
    `saved-variant-slot-checks.md` and
    `reserved-navigation-names-in-authored-html.md` recommend. This adds the
    same build error through one path. Effort: Medium.
- **Left out:** Change nothing. The code then keeps failing the link
  validation requirement.
- **Wider fix:** B. One validation for all authored HTML gives saved slots
  each check of a body.
- **Previous examples:** Saved slots also skip the forbidden and unknown
  element checks of a body. They only warn on reserved navigation names,
  which fail in a body. The two related items below record these cases.
- **Related:**
  - [saved-variant-slot-checks.md](./saved-variant-slot-checks.md) and
    [reserved-navigation-names-in-authored-html.md](./reserved-navigation-names-in-authored-html.md)
    share the wider fix B.
  - Option A here conflicts with the open choice of
    `reserved-navigation-names-in-authored-html.md`. Run unchanged, A makes
    reserved names fail in saved slots before the user chooses there.
- **Recommendation:** B. It gives saved slots this check through the one
  validation that the related items recommend.
- **Action:** ask the user, because A and B add a build error, and C changes
  the link validation requirement.
