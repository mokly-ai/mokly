//! Empty instance identity and saved variant inputs remain caller-owned material.

use mokly_model::review::{EntryChangeReason, ReviewState};

#[expect(
    dead_code,
    reason = "these fixtures edit definitions without relocating files"
)]
mod engine_support;

use engine_support::{Fixture, entry};

const EMPTY: &str = "---\ntitle: Empty\nelement: ui-empty\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n";

#[test]
fn variant_resource_input_edits_do_not_create_component_implementation_impact() {
    let source = "---\ntitle: Image\nelement: ui-image\npropSchema: {type: object, additionalProperties: false, required: [source], properties: {source: {type: string}}}\nprops: {source: ../../a.svg}\nvariants: [{slug: saved, title: Saved, props: {source: ../../../ASSET}}]\n---\n<img src=\"{{source}}\">";
    let fixture = Fixture::new(&[
        (
            "specs/image.component.html",
            &source.replace("ASSET", "a.svg"),
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-image source=\"../../a.svg\"></ui-image>",
        ),
        ("a.svg", "before a"),
        ("b.svg", "before b"),
    ]);
    fixture.edit(
        "specs/image.component.html",
        &source.replace("ASSET", "b.svg"),
    );
    fixture.edit("b.svg", "after b");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["image/saved"]);
    assert!(result.review.affected.is_empty());
}

#[test]
fn adding_removing_and_replacing_empty_instances_changes_each_consumer_view() {
    for (before, after) in [
        ("<main></main>", "<main><ui-empty></ui-empty></main>"),
        ("<main><ui-empty></ui-empty></main>", "<main></main>"),
        ("<ui-empty></ui-empty>", "<ui-other></ui-other>"),
    ] {
        let fixture = Fixture::new(&[
            ("specs/empty.component.html", EMPTY),
            (
                "specs/other.component.html",
                &EMPTY.replace("ui-empty", "ui-other"),
            ),
            (
                "specs/home.screen.html",
                &format!("---\ntitle: Home\n---\n{before}"),
            ),
        ]);
        fixture.edit(
            "specs/home.screen.html",
            &format!("---\ntitle: Home\n---\n{after}"),
        );
        let result = fixture.compare().unwrap();
        assert_eq!(result.snapshot.changed_entries, ["home"]);
        assert!(
            entry(&result, "home")
                .reasons
                .contains(&EntryChangeReason::Structure)
        );
        assert!(
            entry(&result, "home")
                .views
                .iter()
                .all(|view| view.state == ReviewState::Changed)
        );
        assert!(result.review.affected.is_empty());
    }
}

#[test]
fn adding_or_removing_a_saved_variant_does_not_change_component_implementation() {
    let parent = "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nVARIANTS---\n<article>Card</article>";
    let plain = parent.replace("VARIANTS", "");
    let variant = parent.replace(
        "VARIANTS",
        "variants: [{slug: compact, title: Compact, props: {}}]\n",
    );
    for (before, after) in [(&plain, &variant), (&variant, &plain)] {
        let fixture = Fixture::new(&[
            ("specs/card.component.html", before),
            (
                "specs/home.screen.html",
                "---\ntitle: Home\n---\n<ui-card></ui-card>",
            ),
        ]);
        fixture.edit("specs/card.component.html", after);
        let result = fixture.compare().unwrap();
        assert_eq!(result.snapshot.changed_entries, ["card/compact"]);
        assert!(!entry(&result, "card").included);
        assert!(result.review.affected.is_empty());
    }
}

#[test]
fn a_variant_moved_between_parents_does_not_prove_implementation_impact() {
    let parent = "---\ntitle: TITLE\nelement: ELEMENT\npropSchema: {type: object, additionalProperties: false, properties: {}}\nVARIANTS---\n<p>TITLE</p>";
    let card = parent
        .replace("TITLE", "Card")
        .replace("ELEMENT", "ui-card");
    let tile = parent
        .replace("TITLE", "Tile")
        .replace("ELEMENT", "ui-tile");
    let fixture = Fixture::new(&[
        (
            "specs/card.component.html",
            &card.replace(
                "VARIANTS",
                "variants: [{slug: compact, title: Compact, props: {}}]\n",
            ),
        ),
        ("specs/tile.component.html", &tile.replace("VARIANTS", "")),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-card></ui-card><ui-tile></ui-tile>",
        ),
    ]);
    fixture.edit("specs/card.component.html", &card.replace("VARIANTS", ""));
    fixture.edit(
        "specs/tile.component.html",
        &tile.replace(
            "VARIANTS",
            "variants: [{slug: compact, title: Compact, movedFrom: card/compact, props: {}}]\n",
        ),
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["tile/compact"]);
    assert!(result.review.affected.is_empty());
}
