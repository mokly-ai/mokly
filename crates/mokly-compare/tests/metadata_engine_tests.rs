//! Metadata, ignore scopes, variants, use cases, and ownership registration cases.

use mokly_model::review::{EntryChangeReason, ReviewState};

#[expect(
    dead_code,
    reason = "the shared Git fixture also exposes relocation for move tests"
)]
mod engine_support;

use engine_support::{Fixture, entry};

#[test]
fn a_parent_schema_edit_with_variants_lists_only_the_parent_metadata() {
    let source = concat!(
        "---\ntitle: Card\nelement: ui-card\n",
        "propSchema: {type: object, additionalProperties: false, properties: {tone: {type: string, enum: [red, blue]}}}\n",
        "props: {tone: red}\n",
        "variants:\n",
        "  - {slug: one, title: One, props: {tone: red}}\n",
        "  - {slug: two, title: Two, props: {tone: red}}\n",
        "  - {slug: three, title: Three, props: {tone: red}}\n",
        "---\n<article>Card</article>",
    );
    let fixture = Fixture::new(&[("specs/card.component.html", source)]);
    fixture.edit(
        "specs/card.component.html",
        &source.replace("[red, blue]", "[red, green]"),
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert_eq!(
        entry(&result, "card").reasons,
        [EntryChangeReason::Metadata]
    );
    for path in ["card/one", "card/two", "card/three"] {
        let variant = entry(&result, path);
        assert!(!variant.included, "{path}");
        assert!(variant.reasons.is_empty(), "{path}");
        assert_eq!(variant.state, ReviewState::Unchanged, "{path}");
        assert!(
            variant
                .views
                .iter()
                .all(|view| view.state == ReviewState::Unchanged)
        );
    }
}

#[test]
fn a_parent_slot_declaration_edit_does_not_list_variants() {
    let source = concat!(
        "---\ntitle: Card\nelement: ui-card\n",
        "propSchema: {type: object, additionalProperties: false, properties: {}}\n",
        "slots: [children]\n",
        "variants: [{slug: one, title: One, props: {}}, {slug: two, title: Two, props: {}}]\n",
        "---\n<article>Card<slot></slot></article>",
    );
    let fixture = Fixture::new(&[("specs/card.component.html", source)]);
    fixture.edit(
        "specs/card.component.html",
        &source.replace("slots: [children]", "slots: [children, footer]"),
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert_eq!(
        entry(&result, "card").reasons,
        [EntryChangeReason::Metadata]
    );
    for path in ["card/one", "card/two"] {
        assert!(!entry(&result, path).included, "{path}");
        assert!(entry(&result, path).reasons.is_empty(), "{path}");
    }
}

#[test]
fn metadata_membership_does_not_override_an_unchanged_view_aggregate() {
    let fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\ndescription: Before\n---\n<p>Stable</p>",
    )]);
    fixture.edit(
        "specs/home.screen.html",
        "---\ntitle: Home\ndescription: After\n---\n<p>Stable</p>",
    );
    let result = fixture.compare().unwrap();
    let entry = entry(&result, "home");
    assert!(entry.included);
    assert_eq!(entry.reasons, [EntryChangeReason::Metadata]);
    assert_eq!(entry.state, ReviewState::Unchanged);
    assert!(
        entry
            .views
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
}

#[test]
fn metadata_marks_exact_variants_and_direct_screens_propagate_to_use_cases() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\nuseCasePaths: [tour]\nvariants: [{slug: alternate, title: Alternate}]\n---\n<p>Home</p>",
        ),
        (
            "specs/tour.use-case.yaml",
            "title: Tour\nsteps:\n  - screenPath: home\n",
        ),
    ]);
    fixture.edit("specs/home.screen.html", "---\ntitle: Home\nuseCasePaths: [tour]\nvariants: [{slug: alternate, title: Alternate, description: New description}]\n---\n<p>Home</p>");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home/alternate"]);
    assert!(!entry(&result, "home").included);
    assert!(!entry(&result, "tour").included);
    fixture.edit("specs/home.screen.html", "---\ntitle: New Home\nuseCasePaths: [tour]\nvariants: [{slug: alternate, title: Alternate}]\n---\n<p>Home</p>");
    let result = fixture.compare().unwrap();
    assert!(
        entry(&result, "home/alternate")
            .reasons
            .contains(&EntryChangeReason::Metadata)
    );
    assert!(
        entry(&result, "tour")
            .reasons
            .contains(&EntryChangeReason::Screen {
                screen_path: "home".into()
            })
    );
}

#[test]
fn disabled_and_nested_ignore_scopes_resolve_before_comparison() {
    let fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<mokly-ignore-scope enabled=\"false\"><mokly-ignore id=\"outside\">Before</mokly-ignore><mokly-ignore-scope enabled=\"true\"><mokly-ignore id=\"inside\">Before</mokly-ignore></mokly-ignore-scope></mokly-ignore-scope>",
    )]);
    fixture.edit("specs/home.screen.html", "---\ntitle: Home\n---\n<mokly-ignore-scope enabled=\"false\"><mokly-ignore id=\"outside\">Before</mokly-ignore><mokly-ignore-scope enabled=\"true\"><mokly-ignore id=\"inside\">After</mokly-ignore></mokly-ignore-scope></mokly-ignore-scope>");
    let result = fixture.compare().unwrap();
    assert_eq!(
        entry(&result, "home").views[0].state,
        ReviewState::IgnoredOnly
    );
    assert_eq!(entry(&result, "home").views[0].ignored_ids, ["inside"]);
    fixture.edit("specs/home.screen.html", "---\ntitle: Home\n---\n<mokly-ignore-scope enabled=\"false\"><mokly-ignore id=\"outside\">After</mokly-ignore><mokly-ignore-scope enabled=\"true\"><mokly-ignore id=\"inside\">After</mokly-ignore></mokly-ignore-scope></mokly-ignore-scope>");
    assert!(entry(&fixture.compare().unwrap(), "home").included);
}

#[test]
fn material_keys_and_one_sided_ignores_are_material_while_source_locations_are_not() {
    let fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<mokly-ignore id=\"chrome\" material-key=\"one\">Before</mokly-ignore>",
    )]);
    fixture.edit("specs/home.screen.html", "---\ntitle: Home\n---\n<mokly-ignore id=\"chrome\" material-key=\"two\">Before</mokly-ignore>");
    assert!(entry(&fixture.compare().unwrap(), "home").included);
    fixture.edit("specs/home.screen.html", "---\ntitle: Home\n---\n<mokly-ignore id=\"other\" material-key=\"one\">After</mokly-ignore>");
    assert!(entry(&fixture.compare().unwrap(), "home").included);
}

#[test]
fn no_registered_components_does_not_hide_simultaneous_one_sided_content_changes() {
    let fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<article>Before</article>",
    )]);
    fixture.edit("specs/card.component.html", "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<article>After</article>");
    fixture.edit(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<ui-card></ui-card>",
    );
    let result = fixture.compare().unwrap();
    assert!(entry(&result, "home").included);
    assert!(entry(&result, "card").included);
}

#[test]
fn removed_variant_keeps_its_parent_title_when_a_document_reuses_the_parent_path() {
    let fixture = Fixture::new(&[(
        "specs/card.component.html",
        "---\ntitle: Historical Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: compact, title: Compact, props: {}}]\n---\n<article>Card</article>",
    )]);
    fixture.remove("specs/card.component.html");
    fixture.edit("specs/card.md", "# Replacement document\n");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.removed_entries.len(), 1);
    let removed = &result.snapshot.removed_entries[0];
    assert_eq!(removed.entry.metadata().path, "card/compact");
    assert_eq!(removed.parent_title.as_deref(), Some("Historical Card"));
    let lookup = mokly_compare::lookup::Lookup::new(
        "one",
        &result.after.catalogue().model,
        Some(&result.before.catalogue().model),
        &result.snapshot.removed_entries,
        &result.pairing.moves,
    )
    .unwrap();
    assert!(matches!(
        lookup
            .parent("one", mokly_compare::lookup::Destination::Removed(removed))
            .unwrap(),
        Some(mokly_compare::lookup::Parent::Title("Historical Card"))
    ));
    assert!(
        lookup
            .parent(
                "other",
                mokly_compare::lookup::Destination::Removed(removed)
            )
            .is_err()
    );
}

#[test]
fn snapshot_source_validation_rejects_reversed_base_authored_variant_order() {
    let source = "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nVARIANTS---\n<p>Card</p>";
    let fixture = Fixture::new(&[(
        "specs/card.component.html",
        &source.replace(
            "VARIANTS",
            "variants: [{slug: z, title: Z, props: {}}, {slug: a, title: A, props: {}}]\n",
        ),
    )]);
    fixture.edit("specs/card.component.html", &source.replace("VARIANTS", ""));
    let result = fixture.compare().unwrap();
    assert_eq!(
        result
            .snapshot
            .removed_entries
            .iter()
            .map(|record| record.entry.metadata().path.as_str())
            .collect::<Vec<_>>(),
        ["card/z", "card/a"]
    );
    let mut snapshot = result.snapshot.clone();
    snapshot.removed_entries.reverse();
    assert!(
        snapshot
            .validate_sources(
                &result.before.catalogue().model,
                &result.after.catalogue().model
            )
            .is_err()
    );
}
