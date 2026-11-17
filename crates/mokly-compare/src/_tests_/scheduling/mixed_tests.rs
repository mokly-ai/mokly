//! Full mixed-view classification and all comparison work stay equal across schedulers.

use std::sync::Arc;

use mokly_css::parsed_cache::{MemoryParsedCss, ParsedCssCache};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::canonical;
use mokly_model::review::ReviewState;

use crate::comparison::Engine;
use crate::comparison_types::Comparison;
use crate::moves::Detector;

use super::mixed_fixture;
use crate::comparison_types::ComparisonRequest;

#[test]
fn real_pool_and_sequential_default_keep_mixed_results_warnings_and_exact_work_equal() {
    let run = |parallel| {
        let css = Arc::new(MemoryParsedCss::new(65536));
        let result = Engine {
            moves: Arc::new(Detector),
            css: css.clone(),
        }
        .compare_prepared(
            &ComparisonRequest {
                base_ref: "base".into(),
                base_commit: "b".repeat(40),
                catalogue_identity: "a".repeat(64),
            },
            mixed_fixture::generation(false, parallel),
            mixed_fixture::generation(true, parallel),
        )
        .unwrap();
        assert_eq!(
            result
                .entries
                .iter()
                .map(|entry| (entry.path.as_str(), entry.state))
                .collect::<Vec<_>>(),
            [
                ("changed", ReviewState::Changed),
                ("stable", ReviewState::Unchanged),
                ("ignored", ReviewState::IgnoredOnly),
                ("styled", ReviewState::Changed),
                ("moved", ReviewState::Unchanged),
                ("removed", ReviewState::Removed),
                ("added", ReviewState::Added)
            ]
        );
        assert_eq!(
            result
                .entries
                .iter()
                .find(|entry| entry.path == "changed")
                .unwrap()
                .documents
                .iter()
                .map(|view| (view.key.viewport, view.key.color_scheme, view.state))
                .collect::<Vec<_>>(),
            [
                (
                    Some(Viewport::Mobile),
                    ColorScheme::Light,
                    ReviewState::Changed
                ),
                (
                    Some(Viewport::Mobile),
                    ColorScheme::Dark,
                    ReviewState::Unchanged
                ),
                (
                    Some(Viewport::Desktop),
                    ColorScheme::Light,
                    ReviewState::Unchanged
                ),
                (
                    Some(Viewport::Desktop),
                    ColorScheme::Dark,
                    ReviewState::Unchanged
                ),
            ]
        );
        assert_eq!(result.warnings.len(), 24);
        assert_eq!(result.counts.changes, 5);
        assert_eq!(result.counts.moved, 1);
        assert_eq!(result.counts.ignored_only, 1);
        assert_eq!(
            result
                .entries
                .iter()
                .map(|entry| entry.documents.len())
                .sum::<usize>(),
            28
        );
        assert_eq!(css.stats().parses, 2);
        assert_eq!(result.resource_work.diffs, 1);
        eprintln!(
            "mixed parallel={parallel}: work={:?}, css={:?}, affected_lookups={}",
            result.resource_work,
            css.stats(),
            result.affected_lookups
        );
        (
            format!(
                "{:?}",
                (
                    result.entries,
                    result.pairing,
                    result.counts,
                    result.warnings
                )
            ),
            canonical::to_string(&result.review).unwrap(),
            canonical::to_string(&result.snapshot).unwrap(),
            format!("{:?}", result.resource_work),
            format!("{:?}", css.stats()),
            result.affected_lookups,
        )
    };
    assert_eq!(run(true), run(false));
}
