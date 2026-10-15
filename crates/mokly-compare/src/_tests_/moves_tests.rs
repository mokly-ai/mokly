//! Move passes prove uniqueness, preserve ambiguity, and bound full comparisons by hash groups.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation,
};
use unimock::{MockFn, Unimock, matching};

use crate::move_similarity::similarity;
use crate::move_types::{MoveDetector, MoveEvidence, MoveEvidenceMock, MoveLines, MoveSignature};
use crate::moves::Detector;

#[test]
fn same_kind_case_only_names_keep_identity_and_declared_moves_run_first() {
    let before = catalogue(&["Home", "old"]);
    let mut after = catalogue(&["home", "new"]);
    after.entries[1].metadata.moved_from = Some("old".into());
    let evidence: &dyn MoveEvidence = &Unimock::new(());
    let detector: &dyn MoveDetector = &Detector;
    let result = detector.pair(&before, &after, evidence).unwrap();
    assert_eq!(result.moves.len(), 1);
    assert_eq!(result.moves[0].previous_path, "old");
    assert_eq!(result.entries.iter().filter(|pair| !pair.moved).count(), 1);
    assert!(result.diagnostics.is_empty());
}

#[test]
fn a_nonmatching_declaration_blocks_every_later_signal() {
    let before = catalogue(&["old"]);
    let mut after = catalogue(&["new"]);
    after.entries[0].metadata.moved_from = Some("absent".into());
    let evidence: &dyn MoveEvidence = &Unimock::new(
        MoveEvidenceMock::signature
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| {
                Ok(MoveSignature {
                    hash: "same".into(),
                    unignored_hash: "same".into(),
                    ignores: Vec::new(),
                })
            }),
    );
    let result = Detector.pair(&before, &after, evidence).unwrap();
    assert!(result.moves.is_empty());
    assert_eq!(
        result.diagnostics,
        ["new: movedFrom absent matched no removed base entry of kind page"]
    );
}

#[test]
fn identical_ambiguity_is_permanent_and_uses_the_exact_diagnostic_order() {
    let before = catalogue(&["a", "b"]);
    let after = catalogue(&["new"]);
    let evidence = Unimock::new((
        MoveEvidenceMock::signature
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| {
                Ok(MoveSignature {
                    hash: "same".into(),
                    unignored_hash: "same".into(),
                    ignores: Vec::new(),
                })
            }),
        MoveEvidenceMock::equal
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| Ok(true)),
    ));
    let result = Detector.pair(&before, &after, &evidence).unwrap();
    assert!(result.moves.is_empty());
    assert_eq!(
        result.diagnostics,
        ["added page new matches removed entries a and b; declare movedFrom to pair it"]
    );
}

#[test]
fn unique_material_runs_one_full_comparison_per_candidate_at_both_scales() {
    let count = |size| {
        let before = catalogue(
            &(0..size)
                .map(|index| format!("old{index}"))
                .collect::<Vec<_>>()
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>(),
        );
        let after = catalogue(
            &(0..size)
                .map(|index| format!("new{index}"))
                .collect::<Vec<_>>()
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>(),
        );
        let calls = Arc::new(AtomicUsize::new(0));
        let counted = calls.clone();
        let evidence = Unimock::new((
            MoveEvidenceMock::signature
                .each_call(matching!(_, _, _))
                .answers(&|_, _, index, _| {
                    Ok(MoveSignature {
                        hash: index.to_string(),
                        unignored_hash: index.to_string(),
                        ignores: Vec::new(),
                    })
                }),
            MoveEvidenceMock::equal
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    counted.fetch_add(1, Ordering::SeqCst);
                    Ok(true)
                })),
        ));
        let result = Detector.pair(&before, &after, &evidence).unwrap();
        assert_eq!(result.moves.len(), size);
        calls.load(Ordering::SeqCst)
    };
    let smaller = count(16);
    let larger = count(64);
    assert!(smaller > 0);
    assert_eq!(smaller, 16);
    assert_eq!(larger, 4 * smaller);
}

#[test]
fn similarity_is_a_line_multiset_with_an_inclusive_half_threshold() {
    let lines = |values: &[&str]| {
        values
            .iter()
            .map(|value| (*value).into())
            .collect::<Vec<String>>()
    };
    assert_eq!(similarity(&[], &lines(&["x"])), 0.0);
    assert_eq!(
        similarity(&lines(&["x", "x", "y"]), &lines(&["x", "z", "w"])),
        1.0 / 3.0
    );
    assert_eq!(similarity(&lines(&["x", "y"]), &lines(&["x", "z"])), 0.5);
}

#[test]
fn similarity_ties_report_ambiguity_once_and_do_not_accept_a_mutual_subset() {
    let before = catalogue(&["old"]);
    let after = catalogue(&["one", "two"]);
    let evidence = Unimock::new((
        MoveEvidenceMock::signature
            .each_call(matching!(_, _, _))
            .answers(&|_, side, index, _| {
                Ok(MoveSignature {
                    hash: format!("{side:?}-{index}"),
                    unignored_hash: format!("{side:?}-{index}"),
                    ignores: Vec::new(),
                })
            }),
        MoveEvidenceMock::lines
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| {
                Ok(Some(MoveLines {
                    before: vec!["shared".into(), "body".into()],
                    after: vec!["shared".into(), "body".into()],
                }))
            }),
    ));
    let result = Detector.pair(&before, &after, &evidence).unwrap();
    assert!(result.moves.is_empty());
    assert_eq!(
        result.diagnostics,
        ["removed page old matches added entries one and two; declare movedFrom to pair it"]
    );
}

fn catalogue(paths: &[&str]) -> CatalogueModel {
    CatalogueModel {
        entries: paths
            .iter()
            .map(|path| ModelEntry {
                metadata: EntryMetadata {
                    path: (*path).into(),
                    title: (*path).into(),
                    description: String::new(),
                    tags: Vec::new(),
                    rationale: None,
                    related_docs: Vec::new(),
                    moved_from: None,
                    moved_from_source: None,
                    variant_of: None,
                    is_index: false,
                    root_index: 0,
                    source: SourceLocation {
                        path: format!("specs/{path}.page.html"),
                        line: 1,
                        column: 1,
                        export: None,
                    },
                },
                content: EntryContent::Page,
            })
            .collect(),
        folders: Vec::new(),
        sources: Vec::new(),
        color_schemes: vec![ColorScheme::Light],
    }
}
