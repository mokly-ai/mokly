# Page callback wrapper warnings read tree names

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`, finding 10 of its
  implementation review.
- **Location:** `crates/mokly-html/src/javascript.rs:115-128`,
  `crates/mokly-html/src/ignore_checks.rs:16-52`, and
  `docs/protocol/mokly-html-screens.md:139-141` and `:194`.
- **Reason:** The defect needs an ignore wrapper inside SVG, MathML, or a
  table in a page callback document, and the fix costs the same after the
  merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Ignore wrapper:** a `mokly-ignore` or `mokly-ignore-scope` element. It
    marks or scopes a region that Changes ignores, and it leaves nothing in
    the output.
  - **Page callback document:** the complete HTML document that a JavaScript
    `definePage` callback returns through the render sidecar.
  - **Tree builder:** the html5ever 0.39.0 parser stage that builds the
    element tree from the tokens. It changes some attribute names and moves
    some elements.
- **Background:**
  - On 2026-10-21 the user chose to report unknown wrapper attributes for
    page callback documents. On 2026-10-28 the coordinator chose, on Cal's
    behalf, that the Rust core reports them where it removes the attributes,
    with no sidecar wire change. The warning uses the code
    `html-ignore-attribute`, the message of an authored body, and the page's
    `entry` subject. It appears once per page document and attribute, also
    when the document then fails another check, and `--strict` counts it.
    It names the first wrapper in document order, as authored bodies do.
  - `docs/protocol/mokly-html-screens.md:139-141` states these rules.
    `:194` says that the attribute name in the message is in ASCII
    lowercase.
  - Authored bodies: `crates/mokly-catalogue/src/templates.rs:46-58` reads
    the html5gum tokens in source order. The tokenizer gives each attribute
    name in ASCII lowercase. `html_tokens::normalize` removes the unknown
    wrapper attributes, and `templates.rs` warns once for each name, with
    the first wrapper in source order.
  - Page callback documents: `javascript.rs:115-128` parses the document
    into a tree. `ignore_checks::filter_tree`, at `ignore_checks.rs:35-52`,
    removes the unknown wrapper attributes from the tree for the output and
    returns each removed name with its wrapper, in tree order. The tree
    filter keeps the reserved navigation names `data-mokly-link` and
    `data-mokly-link-control…`, so that `source_checks::validate` fails
    them. `javascript.rs` then warns once for each returned name, before
    `source_checks::page` and `source_checks::validate` run.
- **Problem:** The callback pass reads the tree, not the tokens, so it can
  differ from an authored body with the same markup:
  - The tree builder changes the ASCII case of some attribute names in
    foreign content: SVG `viewbox` becomes `viewBox`, `preserveaspectratio`
    becomes `preserveAspectRatio`, and MathML `definitionurl` becomes
    `definitionURL`. The message then breaks the lowercase rule, and one
    authored name can give two warnings.
  - The tree builder moves a wrapper out of a table (foster parenting).
    Tree order then differs from source order, and the warning names a
    different first wrapper than an authored body does.
- **Evidence:** Probes with `mokly build --no-changes` on 2026-11-01:
  - A page callback document with
    `<mokly-ignore id="html" viewbox="x">outside</mokly-ignore>` and, inside
    `<svg>`, `<mokly-ignore id="svg" viewBox="x">inside</mokly-ignore>` gave
    two warnings: `unknown attribute viewBox on <mokly-ignore> is ignored`
    and `unknown attribute viewbox on <mokly-ignore> is ignored`. With
    `--strict`, the build printed "2 build warnings with --strict" and
    exited 1. The same markup in an HTML screen gave one warning, with
    `viewbox`.
  - Callback wrappers inside MathML and SVG gave `definitionURL` and
    `preserveAspectRatio`. `xlink:href` kept its form.
  - With a wrapper that the parser moves out of a table, the screen named
    `<mokly-ignore>` and the callback page named `<mokly-ignore-scope>`.
  - With `select`, `template`, and `foreignObject` markup, the screen and
    the page agreed.
  - The build output unwrapped the SVG wrapper, so it works as an ignore
    wrapper.
  - No test covers a callback wrapper inside SVG or MathML, or a wrapper
    that the parser moves.
- **Impact if no action:** The warning text breaks its defined format, and
  strict mode counts one authored attribute twice. A table layout names a
  different wrapper than the same markup in an authored body.
- **Root question:** How should a page callback document give the same
  wrapper warnings as an authored body with the same markup?
- **Options:**
  - **A.** Convert the removed names to ASCII lowercase before the callback
    duplicate check, and add the reproduced regression case. The table case
    stays. Effort: Small.
  - **B.** Add a normalized ignored-attribute record for both warning
    producers. Its constructor fixes the name once, and the duplicate check
    and the message use it. Add the reproduced regression case. The table
    case stays. Effort: Small.
  - **C.** Collect the callback warnings with the token collector of
    authored bodies, before `source_checks::page` and
    `source_checks::validate` run. Skip the reserved navigation names, as
    the tree filter does today. Keep the tree filter for the output. Add
    regression cases for SVG, MathML, and a table, and update the
    `crates/mokly-html/README.md` paragraph on page callback warnings.
    Effort: Medium.
- **Left out:**
  - Change nothing. One authored name keeps two warnings.
  - Change only the formatter. The duplicate check would still use names
    that differ in case.
  - Permit adjusted names in the contract. One authored attribute keeps two
    names, and a callback page still prints a name that differs from the
    authored body, against the decision of 2026-10-28.
  - Sort the tree wrappers by source position. Delivered HTML has no source
    positions, and C is better on every point.
  - Record the token names during the tree parse, through the `before_token`
    hook of the tree builder's storage. C gives the same names and order,
    and it reuses the authored collector.
  - Accept tree order for callbacks and document it. It breaks the decision
    of 2026-10-28: the first wrapper as authored bodies name it.
  - A fix in the parser sink, `crates/mokly-html/src/html_sink.rs`. It is A
    inside the shared parser, and it keeps the tree order.
  - A fix in the sidecar. The decision of 2026-10-28 rejected a TypeScript
    copy of the rule and a wire change.
  - Skip wrappers inside SVG and MathML. Composition unwraps them as working
    wrappers.
- **Wider fix:** C. A and B work only because the tree names differ from the
  token names in ASCII case alone. Only C also prevents the table form.
- **Related:**
  [reserved-navigation-names-in-authored-html.md](./reserved-navigation-names-in-authored-html.md)
  waits for the user. Its option C removes the reserved-name form of
  `html-ignore-attribute`. Until it is answered, C here keeps the reserved
  navigation names out of callback warnings.
- **Previous examples:** Commit `02eec937` made the checks and the tree read
  one token stream. No earlier warning-name case after SVG or MathML name
  adjustment was found.
- **Recommendation:** C. It removes the shared cause, so a callback page
  matches an authored body in name, count, and first wrapper. The review
  first recommended B, which leaves the table case.
- **Action:** fix after merge, apply C, because the defect needs a wrapper
  inside SVG, MathML, or a table in a page callback document, and the fix
  costs the same after the merge.
