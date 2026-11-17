//! One rolling stream spans entries, preserves empty pairs, and releases inputs.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::review::ReviewState;
use unimock::{MockFn, Unimock, matching};

use crate::comparison::Engine;
use crate::comparison_types::{Comparison, ComparisonRequest};
use crate::move_types::{EntryPair, MoveDetectorMock, Pairing};

use super::control::Control;
use super::support::{captured, source};

#[test]
fn rolling_views_cross_entries_keep_each_key_and_bound_all_started_unconsumed_slots() {
    let control = Arc::new(Control {
        entry_counts: Some(vec![3, 0, 2]),
        rolling: true,
        ..Default::default()
    });
    let before = captured(source(1, 5, control.clone()), &[0, 1, 2, 3, 4]);
    let after = source(2, 5, control.clone());
    let result = Engine {
        moves: Arc::new(Unimock::new(
            MoveDetectorMock::pair
                .some_call(matching!(_, _, _))
                .returns(Ok(Pairing {
                    entries: (0..3)
                        .map(|index| EntryPair {
                            before: Some(index),
                            after: Some(index),
                            moved: index == 0,
                        })
                        .collect(),
                    ..Default::default()
                })),
        )),
        css: Arc::new(MemoryParsedCss::new(4096)),
    }
    .compare_prepared(
        &ComparisonRequest {
            base_ref: "base".into(),
            base_commit: "b".repeat(40),
            catalogue_identity: "a".repeat(64),
        },
        before,
        after,
    )
    .unwrap();
    assert_eq!(
        control.stream_calls.load(Ordering::SeqCst),
        1,
        "one stream must span every entry pair"
    );
    assert_eq!(*control.admitted.lock().unwrap(), [0, 1, 2, 3, 4]);
    let mut started = control.started.lock().unwrap().clone();
    started.sort_unstable();
    assert_eq!(started, [0, 1, 2, 3, 4]);
    assert_eq!(*control.consumed.lock().unwrap(), [0, 1, 2, 3, 4]);
    assert_eq!(*control.window.lock().unwrap(), [4, 4, 3, 2, 1]);
    assert_eq!(control.live(), 0);
    assert_eq!(
        result
            .entries
            .iter()
            .map(|entry| (entry.path.as_str(), entry.documents.len()))
            .collect::<Vec<_>>(),
        [("screen0", 3), ("screen1", 0), ("screen2", 2)]
    );
    let states: Vec<_> = result
        .entries
        .iter()
        .flat_map(|entry| {
            entry.documents.iter().map(|view| {
                (
                    entry.path.as_str(),
                    view.key.viewport,
                    view.key.color_scheme,
                    view.state,
                    view.after_route.as_deref().unwrap(),
                )
            })
        })
        .collect();
    assert_eq!(
        states,
        [
            (
                "screen0",
                Some(Viewport::Mobile),
                ColorScheme::Light,
                ReviewState::Unchanged,
                "screen/0.html"
            ),
            (
                "screen0",
                Some(Viewport::Mobile),
                ColorScheme::Dark,
                ReviewState::Unchanged,
                "screen/1.html"
            ),
            (
                "screen0",
                Some(Viewport::Desktop),
                ColorScheme::Light,
                ReviewState::Unchanged,
                "screen/2.html"
            ),
            (
                "screen2",
                Some(Viewport::Mobile),
                ColorScheme::Light,
                ReviewState::Unchanged,
                "screen/3.html"
            ),
            (
                "screen2",
                Some(Viewport::Mobile),
                ColorScheme::Dark,
                ReviewState::Unchanged,
                "screen/4.html"
            ),
        ]
    );
    assert_eq!(result.resource_work.reads, 10);
}
