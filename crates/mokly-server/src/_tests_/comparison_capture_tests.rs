//! A selection captures only its own unchanged bytes and transitive public resources.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::axes::EntryKind;
use mokly_model::readers;
use mokly_model::review::{EntryChangeReason, ReviewKind, ReviewState};
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeCancellation, ChangeToken};
use crate::comparison_capture::{Capturer, SnapshotCapture};
use crate::comparison_support::{accepted, compact};
use crate::error::ServerError;

fn graph(bytes: &'static [u8], resource: &'static [u8]) -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new((
        RenderGenerationMock::render
            .next_call(matching!("sample/index.mobile.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: bytes.into(),
                document: None,
                fragment: None,
                content_type: "text/html".into(),
            }))),
        RenderGenerationMock::closure
            .next_call(matching!("sample/index.mobile.html"))
            .returns(Ok(Closure {
                edges: [
                    ("static/theme.css".into(), vec!["image.png".into()]),
                    ("static/image.png".into(), vec![]),
                ]
                .into(),
                ..Default::default()
            })),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/image.png"))
            .returns(Ok(Some(resource.into()))),
        RenderGenerationMock::resource_bytes
            .next_call(matching!("static/theme.css"))
            .returns(Ok(Some(b"a { background: url(image.png) }".to_vec()))),
    )))
}

#[test]
fn selection_keeps_side_bytes_and_reads_no_other_entry() {
    let accepted = accepted(
        graph(b"<p>before</p>", b"old-image"),
        graph(b"<p>after</p>", b"new-image"),
    );
    let capture: &dyn Capturer = &SnapshotCapture;
    let files = capture
        .capture(&accepted, "sample", false, Arc::new(ChangeToken::default()))
        .unwrap();
    assert_eq!(
        files["snapshots/before/mokly-generated/sample/index.mobile.html"].bytes,
        "<p>before</p>"
    );
    assert_eq!(
        files["snapshots/after/mokly-generated/sample/index.mobile.html"].bytes,
        "<p>after</p>"
    );
    assert_eq!(files["snapshots/before/image.png"].bytes, "old-image");
    assert_eq!(files["snapshots/after/image.png"].bytes, "new-image");
    assert!(!files.keys().any(|path| path.contains("unused")));
    let review =
        readers::review(std::str::from_utf8(&files["review.json"].bytes).unwrap()).unwrap();
    assert_eq!(review.entries.len(), 1);
    assert!(review.affected.is_empty());
    assert!(review.diagnostics.is_empty());
}

#[test]
fn a_selection_writes_its_review_result_in_the_compact_form() {
    let accepted = accepted(
        graph(b"<p>before</p>", b"old-image"),
        graph(b"<p>after</p>", b"new-image"),
    );
    let capture: &dyn Capturer = &SnapshotCapture;
    let files = capture
        .capture(&accepted, "sample", false, Arc::new(ChangeToken::default()))
        .unwrap();
    let text = std::str::from_utf8(&files["review.json"].bytes).unwrap();
    assert_eq!(text, compact(&readers::review(text).unwrap()));
    assert_eq!(text.matches('\n').count(), 1);
}

#[test]
fn cancelled_or_unknown_selections_never_read_a_graph() {
    let accepted = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let token = Arc::new(ChangeToken::default());
    token.cancel();
    let capture: &dyn Capturer = &SnapshotCapture;
    assert!(matches!(
        capture.capture(&accepted, "sample", false, token.clone()),
        Err(ServerError::ChangesReplaced)
    ));
    assert!(matches!(
        capture.capture(&accepted, "missing", false, token.clone()),
        Err(ServerError::ChangesUnavailable)
    ));
    assert!(matches!(
        capture.capture(&accepted, "sample", true, token.clone()),
        Err(ServerError::ChangesUnavailable)
    ));
}

#[test]
fn added_side_never_reads_the_base_and_component_parent_omits_variants() {
    for component in [false, true] {
        let mut accepted = accepted(Arc::new(Unimock::new(())), graph(b"<p>added</p>", b"new"));
        let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
        let review = &mut result.review.entries[0];
        review.before = None;
        review.state = ReviewState::Added;
        review.reasons = vec![EntryChangeReason::Added];
        review.views[0].state = ReviewState::Added;
        if component {
            review.kind = ReviewKind::Component;
            review.after.as_mut().unwrap().supplied_slots = Some(vec![]);
            let mut variant = review.clone();
            variant.path = "sample/variant".into();
            variant.after.as_mut().unwrap().path = variant.path.clone();
            review.variants = Some(vec![variant]);
            result.entries[0].kind = EntryKind::Component;
        }
        result.entries[0].state = ReviewState::Added;
        result.entries[0].documents[0].before_route = None;
        result.entries[0].documents[0].state = ReviewState::Added;
        let capture: &dyn Capturer = &SnapshotCapture;
        let files = capture
            .capture(&accepted, "sample", false, Arc::new(ChangeToken::default()))
            .unwrap();
        assert!(
            !files
                .keys()
                .any(|path| path.starts_with("snapshots/before/"))
        );
        let review =
            readers::review(std::str::from_utf8(&files["review.json"].bytes).unwrap()).unwrap();
        assert_eq!(review.entries.len(), 1);
        assert!(review.entries[0].before.is_none());
        assert!(review.entries[0].variants.is_none());
    }
}

#[test]
fn removed_components_capture_the_before_side_and_removed_screens_use_previews() {
    for component in [true, false] {
        let before: Arc<dyn RenderGeneration> = if component {
            graph(b"<p>removed component</p>", b"old-image")
        } else {
            Arc::new(Unimock::new(()))
        };
        let mut accepted = accepted(before, Arc::new(Unimock::new(())));
        let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
        let review = &mut result.review.entries[0];
        review.after = None;
        review.state = ReviewState::Removed;
        review.reasons = vec![EntryChangeReason::Removed];
        review.views[0].state = ReviewState::Removed;
        if component {
            review.kind = ReviewKind::Component;
            review.before.as_mut().unwrap().supplied_slots = Some(vec![]);
            result.entries[0].kind = EntryKind::Component;
        }
        result.entries[0].state = ReviewState::Removed;
        result.entries[0].documents[0].after_route = None;
        result.entries[0].documents[0].state = ReviewState::Removed;
        let capture: &dyn Capturer = &SnapshotCapture;
        let files = capture.capture(&accepted, "sample", false, Arc::new(ChangeToken::default()));
        if !component {
            assert!(matches!(files, Err(ServerError::ChangesUnavailable)));
            continue;
        }
        let files = files.unwrap();
        assert_eq!(
            files["snapshots/before/mokly-generated/sample/index.mobile.html"].bytes,
            "<p>removed component</p>"
        );
        assert!(
            !files
                .keys()
                .any(|path| path.starts_with("snapshots/after/"))
        );
        let review =
            readers::review(std::str::from_utf8(&files["review.json"].bytes).unwrap()).unwrap();
        assert_eq!(review.entries.len(), 1);
        assert!(review.entries[0].before.is_some());
        assert!(review.entries[0].after.is_none());
        assert_eq!(review.entries[0].state, ReviewState::Removed);
    }
}

#[test]
fn a_current_screen_wins_over_a_removed_component_at_the_same_path() {
    let mut accepted = accepted(
        Arc::new(Unimock::new(())),
        graph(b"<p>current screen</p>", b"new"),
    );
    let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
    let mut removed = result.review.entries[0].clone();
    removed.kind = ReviewKind::Component;
    removed.after = None;
    removed.before.as_mut().unwrap().supplied_slots = Some(vec![]);
    removed.state = ReviewState::Removed;
    removed.reasons = vec![EntryChangeReason::Removed];
    removed.views[0].state = ReviewState::Removed;
    let current = &mut result.review.entries[0];
    current.before = None;
    current.state = ReviewState::Added;
    current.reasons = vec![EntryChangeReason::Added];
    current.views[0].state = ReviewState::Added;
    result.review.entries.insert(0, removed);
    let mut removed = result.entries[0].clone();
    removed.kind = EntryKind::Component;
    removed.state = ReviewState::Removed;
    removed.reasons = vec![EntryChangeReason::Removed];
    removed.documents[0].after_route = None;
    removed.documents[0].state = ReviewState::Removed;
    result.entries[0].state = ReviewState::Added;
    result.entries[0].reasons = vec![EntryChangeReason::Added];
    result.entries[0].documents[0].before_route = None;
    result.entries[0].documents[0].state = ReviewState::Added;
    result.entries.insert(0, removed);
    let capture: &dyn Capturer = &SnapshotCapture;
    let files = capture
        .capture(&accepted, "sample", false, Arc::new(ChangeToken::default()))
        .unwrap();
    let review =
        readers::review(std::str::from_utf8(&files["review.json"].bytes).unwrap()).unwrap();
    assert_eq!(review.entries[0].kind, ReviewKind::Screen);
    assert_eq!(
        files["snapshots/after/mokly-generated/sample/index.mobile.html"].bytes,
        "<p>current screen</p>"
    );
    assert!(
        !files
            .keys()
            .any(|path| path.starts_with("snapshots/before/"))
    );
}
