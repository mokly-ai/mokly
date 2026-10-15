//! Behaviour fixtures compare real Git sources through the same HTML render graph.

use mokly_model::canonical;
use mokly_model::review::{EntryChangeReason, ReviewState};

mod engine_support;

use engine_support::{Fixture, entry};

#[test]
fn source_formatting_ignored_changes_and_each_missing_side_classify_independently() {
    let fixture = Fixture::new(&[
        (
            "specs/stable.screen.html",
            "---\ntitle: Stable\n---\n<p class=\"x\" id=\"y\">Hello &amp; welcome</p>",
        ),
        (
            "specs/ignored.screen.html",
            "---\ntitle: Ignored\n---\n<main>Content</main><mokly-ignore id=\"chrome\"><p>Before</p></mokly-ignore>",
        ),
        (
            "specs/changed.screen.html",
            "---\ntitle: Changed\n---\n<p>Before</p>",
        ),
        (
            "specs/removed.screen.html",
            "---\ntitle: Removed\n---\n<p>Removed</p>",
        ),
    ]);
    fixture.edit(
        "specs/stable.screen.html",
        "---\ntitle: Stable\n---\n<p id=y class=x>Hello &#38; welcome</p>",
    );
    fixture.edit("specs/ignored.screen.html", "---\ntitle: Ignored\n---\n<main>Content</main><mokly-ignore id=\"chrome\"><p>After</p></mokly-ignore>");
    fixture.edit(
        "specs/changed.screen.html",
        "---\ntitle: Changed\n---\n<p>After</p>",
    );
    fixture.remove("specs/removed.screen.html");
    fixture.edit(
        "specs/added.screen.html",
        "---\ntitle: Added\n---\n<p>Added</p>",
    );
    let result = fixture.compare().unwrap();
    for (path, state) in [
        ("stable", ReviewState::Unchanged),
        ("ignored", ReviewState::IgnoredOnly),
        ("changed", ReviewState::Changed),
        ("removed", ReviewState::Removed),
        ("added", ReviewState::Added),
    ] {
        assert!(
            entry(&result, path)
                .views
                .iter()
                .all(|view| view.state == state),
            "{path}"
        );
    }
    assert_eq!(
        result.snapshot.changed_entries,
        ["added", "changed", "removed"]
    );
    assert_eq!(result.counts.changes, 3);
    assert_eq!(result.counts.ignored_only, 1);
    assert_eq!(entry(&result, "ignored").views[0].ignored_ids, ["chrome"]);
    let text = canonical::to_string(&result.review).unwrap();
    assert_eq!(
        text,
        canonical::to_string(&mokly_model::readers::review(&text).unwrap()).unwrap()
    );
    let snapshot = canonical::to_string(&result.snapshot).unwrap();
    assert_eq!(
        snapshot,
        canonical::to_string(&mokly_model::readers::change_snapshot(&snapshot).unwrap()).unwrap()
    );
}

#[test]
fn component_render_changes_keep_consumers_affected_and_inputs_and_slots_stay_with_callers() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-card label=\"Shown\"><p>Caller</p></ui-card>",
        ),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}}}\nprops: {label: Own}\nslots: [children]\n---\n<article><h2>{{label}}</h2><slot></slot></article>",
        ),
    ]);
    fixture.edit("specs/card.component.html", "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, required: [label], properties: {label: {type: string}}}\nprops: {label: Own}\nslots: [children]\n---\n<section><h2>{{label}}</h2><slot></slot></section>");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert!(!entry(&result, "home").included);
    assert!(
        entry(&result, "home")
            .views
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
    assert_eq!(result.review.affected.len(), 1);
    assert_eq!(result.review.affected[0].consumer.path, "home");
    fixture.edit(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<ui-card label=\"New\"><p>New caller</p></ui-card>",
    );
    let result = fixture.compare().unwrap();
    assert!(
        entry(&result, "home")
            .reasons
            .contains(&EntryChangeReason::Inputs)
    );
    assert!(entry(&result, "home").included);
}

#[test]
fn pure_moves_documents_pages_and_removed_titles_share_one_snapshot() {
    let fixture = Fixture::new(&[
        ("specs/group/_folder.json", "{\"title\":\"Base group\"}"),
        (
            "specs/group/old.screen.html",
            "---\ntitle: Screen\n---\n<h1>Same</h1>",
        ),
        ("specs/group/guide.md", "# Guide\n\nOld body\n"),
        (
            "specs/removed.page.html",
            "---\ntitle: Page\n---\n<!doctype html><html><head><title>Page</title></head><body>Old</body></html>",
        ),
    ]);
    fixture.relocate("specs/group/old.screen.html", "specs/new.screen.html");
    fixture.remove("specs/group/guide.md");
    fixture.remove("specs/removed.page.html");
    fixture.edit("specs/group/_folder.json", "{\"title\":\"Current group\"}");
    fixture.edit(
        "specs/group/keep.screen.html",
        "---\ntitle: Keep\n---\n<p>Keep</p>",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(
        entry(&result, "new").previous_path.as_deref(),
        Some("group/old")
    );
    assert!(entry(&result, "new").reasons.is_empty());
    assert_eq!(result.counts.moved, 1);
    let removed = result
        .snapshot
        .removed_entries
        .iter()
        .find(|record| record.entry.metadata().path == "group/guide")
        .unwrap();
    assert_eq!(removed.folder_titles, ["Base group"]);
    assert_eq!(removed.snapshot_id.len(), 64);
    assert_eq!(result.snapshot.removed_entries.len(), 2);
    let snapshot = canonical::to_string(&result.snapshot).unwrap();
    assert_eq!(
        snapshot,
        canonical::to_string(&mokly_model::readers::change_snapshot(&snapshot).unwrap()).unwrap()
    );
    assert!(
        result
            .review
            .entries
            .iter()
            .all(|entry| entry.path != "removed" && entry.path != "group/guide")
    );
    let historical = result.before.render("removed/index.html").unwrap();
    assert!(String::from_utf8_lossy(&historical.bytes).contains("Old"));
}

#[test]
fn duplicated_caller_slot_placement_changes_the_component_through_an_actual_instance() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-card><p>Caller</p></ui-card>",
        ),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<article><slot></slot></article>",
        ),
    ]);
    fixture.edit("specs/card.component.html", "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<article><slot></slot><slot></slot></article>");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["card"]);
    assert!(!entry(&result, "home").included);
    assert_eq!(result.review.affected[0].consumer.path, "home");
}
