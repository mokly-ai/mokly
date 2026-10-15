//! Real source-side move evidence covers declarations, logical references, and resources.

use mokly_compare::lookup::{Destination, Lookup};
use mokly_model::axes::EntryKind;
use mokly_model::review::EntryChangeReason;
use mokly_model::review_affected::ReviewSide;

mod engine_support;

use engine_support::{Fixture, entry};

#[test]
fn declared_edited_moves_and_case_only_names_keep_the_correct_sides() {
    let fixture = Fixture::new(&[("specs/Old.screen.html", "---\ntitle: Old\n---\n<p>Old</p>")]);
    fixture.relocate("specs/Old.screen.html", "specs/new.screen.html");
    fixture.edit(
        "specs/new.screen.html",
        "---\ntitle: New\nmovedFrom: Old\n---\n<p>Edited</p>",
    );
    let result = fixture.compare().unwrap();
    let moved = entry(&result, "new");
    assert_eq!(moved.before.as_ref().unwrap().path, "Old");
    assert_eq!(moved.after.as_ref().unwrap().title, "New");
    assert_eq!(moved.previous_path.as_deref(), Some("Old"));
    assert!(moved.reasons.contains(&EntryChangeReason::Material));
    fixture.remove("specs/new.screen.html");
    fixture.edit("specs/old.screen.html", "---\ntitle: Old\n---\n<p>Old</p>");
    let result = fixture.compare().unwrap();
    assert!(result.pairing.moves.is_empty());
    assert_eq!(entry(&result, "old").before.as_ref().unwrap().path, "Old");
    assert!(
        entry(&result, "old")
            .reasons
            .contains(&EntryChangeReason::Metadata)
    );
    let lookup = Lookup::new(
        "generation",
        &result.after.catalogue().model,
        Some(&result.before.catalogue().model),
        &result.snapshot.removed_entries,
        &result.pairing.moves,
    )
    .unwrap();
    assert_eq!(
        lookup
            .counterpart("generation", EntryKind::Screen, "old")
            .unwrap(),
        Some("Old")
    );
    assert_eq!(
        lookup
            .previous("generation", EntryKind::Screen, "old")
            .unwrap(),
        None
    );
    assert!(
        lookup
            .reference("generation", ReviewSide::Before, EntryKind::Document, "Old")
            .unwrap()
            .is_none()
    );
}

#[test]
fn parent_moves_claim_same_slug_variants_and_preserve_removed_parent_titles() {
    let fixture = Fixture::new(&[(
        "specs/card.component.html",
        "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: one, title: One, props: {}}, {slug: two, title: Two, props: {}}]\n---\n<article>Card</article>",
    )]);
    fixture.remove("specs/card.component.html");
    fixture.edit("specs/new-card.component.html", "---\ntitle: Card\nelement: ui-card\nmovedFrom: card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: one, title: One, props: {}}]\n---\n<article>Card</article>");
    let result = fixture.compare().unwrap();
    assert_eq!(result.counts.moved, 2);
    assert_eq!(
        entry(&result, "new-card/one").previous_path.as_deref(),
        Some("card/one")
    );
    assert_eq!(
        result.snapshot.removed_entries[0].parent_title.as_deref(),
        Some("Card")
    );
    let lookup = Lookup::new(
        "generation",
        &result.after.catalogue().model,
        Some(&result.before.catalogue().model),
        &result.snapshot.removed_entries,
        &result.pairing.moves,
    )
    .unwrap();
    assert!(
        matches!(lookup.reference("generation", ReviewSide::Before, EntryKind::Component, "card").unwrap(), Some(Destination::Current(entry)) if entry.metadata.path == "new-card")
    );
    assert!(
        lookup
            .reference(
                "generation",
                ReviewSide::After,
                EntryKind::Component,
                "card"
            )
            .unwrap()
            .is_none()
    );
}

#[test]
fn moving_link_targets_is_normalized_before_later_identical_content_passes() {
    let fixture = Fixture::new(&[
        (
            "specs/target.screen.html",
            "---\ntitle: Target\n---\n<p>Target</p>",
        ),
        (
            "specs/source.screen.html",
            "---\ntitle: Source\n---\n<a href=\"mock:target\">Target</a>",
        ),
    ]);
    fixture.relocate("specs/target.screen.html", "specs/new-target.screen.html");
    fixture.remove("specs/source.screen.html");
    fixture.edit(
        "specs/new-source.screen.html",
        "---\ntitle: Source\n---\n<a href=\"mock:new-target\">Target</a>",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.counts.moved, 2);
    assert!(entry(&result, "new-source").reasons.is_empty());
}

#[test]
fn relocated_image_references_require_paired_byte_proof() {
    let fixture = Fixture::new(&[
        (
            "specs/old.screen.html",
            "---\ntitle: Image\n---\n<img src=\"../../old.svg\">",
        ),
        ("old.svg", "same bytes"),
    ]);
    fixture.remove("specs/old.screen.html");
    fixture.remove("old.svg");
    fixture.edit("new.svg", "same bytes");
    fixture.edit(
        "specs/new.screen.html",
        "---\ntitle: Image\n---\n<img src=\"../../new.svg\">",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.counts.moved, 1);
    assert!(entry(&result, "new").reasons.is_empty());
    fixture.edit("new.svg", "different bytes");
    fixture.edit(
        "specs/new.screen.html",
        "---\ntitle: Image\nmovedFrom: old\n---\n<img src=\"../../new.svg\">",
    );
    let result = fixture.compare().unwrap();
    assert!(entry(&result, "new").reasons.iter().any(|reason| matches!(reason, EntryChangeReason::Dependency { path } if path == "static/new.svg")));
}

#[test]
fn pure_moved_references_do_not_propagate_screen_reasons_into_a_flow() {
    let fixture = Fixture::new(&[
        (
            "specs/old.screen.html",
            "---\ntitle: Screen\nuseCasePaths: [tour]\n---\n<p>Screen</p>",
        ),
        (
            "specs/tour.use-case.yaml",
            "title: Tour\nsteps: [{screenPath: old}]\n",
        ),
    ]);
    fixture.remove("specs/old.screen.html");
    fixture.edit(
        "specs/new.screen.html",
        "---\ntitle: Screen\nuseCasePaths: [tour]\n---\n<p>Screen</p>",
    );
    fixture.edit(
        "specs/tour.use-case.yaml",
        "title: Tour\nsteps: [{screenPath: new}]\n",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["new"]);
    assert!(!entry(&result, "tour").included);
    assert!(entry(&result, "new").reasons.is_empty());
}
