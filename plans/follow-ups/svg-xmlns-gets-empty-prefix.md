# SVG xmlns gets an empty prefix in output

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `crates/mokly-html/src/html_sink.rs:159-167`.
- **Reason:** The defect is outside the scope of the change that found it, and its fix changes the bytes of every affected document.

- **Source:** Review.
- **Category:** Product bug.
- **Background:**
  - The core parses each rendered fragment with the html5ever parser and keeps its own tree, as `docs/protocol/mokly-rendering.md:21-24` states.
  - `attribute` in `crates/mokly-html/src/html_sink.rs:159-167` writes a prefixed attribute name as `{prefix}:{local}`.
  - In SVG content, html5ever 0.39.0 gives the `xmlns` attribute an empty prefix: `qualname!("" xmlns "xmlns")`, in its file `src/tree_builder/mod.rs:1839`. So `attribute` writes `:xmlns` in place of `xmlns`.
  - The Mokly 0.18.0 upgrade of the cloud found `:xmlns` on inline SVG elements of React documents. Browsers show no difference. Nobody reproduced it in a later build.
- **Problem:** Output documents carry the attribute name `:xmlns` in place of `xmlns` on inline SVG elements.
- **Impact if no action:** The output differs from the authored markup, and a strict reader of the HTML can reject the attribute.
- **Root question:** How does the core write an attribute name whose prefix is empty?
- **Options:**
  - **A.** Write the local name alone when the prefix is empty. Add a test with an inline SVG that carries `xmlns`. Effort: Small.
  - **B.** Write each foreign attribute name under the HTML serialization rules, such as `xlink:href` and `xml:lang`, from its namespace and local name. Effort: Medium.
- **Left out:** Drop the `xmlns` attribute. The author wrote it, and HTML allows it.
- **Wider fix:** B, because it applies the serialization rule to every foreign attribute.
- **Previous examples:** None found.
- **Recommendation:** A. html5ever gives an empty prefix only to `xmlns`, so A fixes every known case with one test. B protects the codebase best.
- **Action:** fix after merge, apply A, because the defect is outside the scope of the change that found it.
