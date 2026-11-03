# Design calls of the viewer checks change

This file holds my design calls for [the plan](../viewer-checks-from-rust.md),
made on 2026-11-03 under option G of
[decision 1](./decisions.md#1-the-trial-shows-a-large-cost-for-option-f). They
replace my calls of 2026-11-02, which served the wasm2js options. The pull
request of the plan deletes this file with the plan.

1. A receiver, such as Mokly Cloud, checks an upload with a lenient mode of
   the Rust readers. The mode ignores unknown fields at every depth, rejects
   misplaced fields, and applies the privacy rules. A newer writer can add
   optional fields under the same format number, so a strict receiver would
   reject a newer client until it updates.
2. Each tagged union decodes through a raw record that rejects the fields of
   its other variants, in both modes. The strict mode keeps the re-encode
   comparison for unknown fields, and the lenient mode skips it. The
   `deny_unknown_fields` attributes go, because the comparison already
   rejects unknown fields in the strict mode.
3. Mokly Cloud depends on `mokly-model` from Git at a pinned commit, and the
   crate stays unpublished. One known receiver does not need a crates.io
   release process.
4. The viewer keeps its failure state for bad JSON. An error catcher around
   the shell shows the existing failure state with Retry, and it reports
   `onError` with the code `catalogue`. The namespace contract keeps a
   malformed document apart from a version failure, and the always-on rules
   prefer a clean failure to a crash.
5. The delivery fence keeps the revision, the `detailId`, the identity, and
   the deployment check. The content matching goes. The fence keeps live
   updates and static replacements correct, and content matching is a check
   of the content.
6. `readCatalogueIndex`, `readEntryDetail`, and `MoklyVersionError` keep
   their names and signatures. A reader checks the version and returns a
   typed copy of the JSON. These are entries of a published package, and the
   public export ratchet checks them.
7. `mokly-model` keeps `jsonschema`. The size problem of the trial affects
   only code that ships to a browser, and G ships no Rust code there.
8. The viewer's URL checks, the in-frame inspector's checks, and the checks
   of live prop edits stay. They check what a user or an author enters, not
   catalogue JSON. Today the live-edit check also checks the entry's schema
   again. Decision 3 covers that, and how these checks agree with the core.
