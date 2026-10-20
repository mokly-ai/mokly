//! One validated composition per route, independent of artifact-cache retention.

use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::collection::ComparisonCollectorMock;
use crate::error::GraphError;
use crate::types::RenderGeneration;

use super::collection_support;

#[test]
fn validated_collection_composes_each_view_once_at_one_and_four_sizes() {
    let run = |count| {
        let probe = collection_support::probe(count);
        let expected_summary = probe.session.render_all().unwrap();
        probe.renders.lock().unwrap().clear();
        let received = Arc::new(Mutex::new(Vec::new()));
        let recorded = received.clone();
        let composed = probe.renders.clone();
        let mut collector = Unimock::new(
            ComparisonCollectorMock::collect
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, route, input| {
                    assert!(
                        String::from_utf8_lossy(&input.artifact.bytes).contains("id=\"anchor\"")
                    );
                    assert!(input.closure.files.is_empty());
                    let pending = composed.lock().unwrap().len() - recorded.lock().unwrap().len();
                    assert!((1..=2).contains(&pending));
                    recorded.lock().unwrap().push(route.to_owned());
                    Ok(())
                })),
        );
        let summary = probe.session.collect_comparison(&mut collector).unwrap();
        assert_eq!(summary.documents, count);
        assert_eq!(summary.warnings, expected_summary.warnings);
        assert_eq!(summary.closure, expected_summary.closure);
        assert_eq!(summary.warnings.len(), count + 1);
        assert_eq!(
            *received.lock().unwrap(),
            probe.session.plans().keys().cloned().collect::<Vec<_>>()
        );
        let rendered = probe.renders.lock().unwrap();
        assert_eq!(rendered.len(), count);
        for entry in &probe.session.catalogue().model.entries {
            assert_eq!(
                rendered
                    .iter()
                    .filter(|path| **path == entry.metadata.path)
                    .count(),
                1
            );
        }
        rendered.len()
    };
    let small = run(4);
    assert!(small > 0);
    assert_eq!(run(16), 4 * small);
}

#[test]
fn collection_keeps_full_validation_errors_and_warnings_ahead_of_encoding_failure() {
    for cross_link in [false, true] {
        let probe = collection_support::probe(4);
        {
            let mut options = probe.options.lock().unwrap();
            options.cross_link = cross_link;
            if !cross_link {
                options
                    .invalid
                    .extend(["page-001".into(), "page-003".into()]);
            }
        }
        let expected = probe.session.render_all().unwrap_err();
        probe.renders.lock().unwrap().clear();
        let mut collector = Unimock::new(
            ComparisonCollectorMock::collect
                .next_call(matching!(_, _))
                .returns(Err(GraphError::InputsChanged {
                    path: "collector".into(),
                })),
        );
        let actual = probe
            .session
            .collect_comparison(&mut collector)
            .unwrap_err();
        assert_eq!(format!("{actual:?}"), format!("{expected:?}"));
        assert_eq!(actual.warnings(), expected.warnings());
        let order = if cross_link {
            [
                "preparation",
                "page-000",
                "page-001",
                "page-002",
                "page-003",
            ]
        } else {
            [
                "preparation",
                "page-000",
                "page-002",
                "page-001",
                "page-003",
            ]
        };
        assert_eq!(
            actual
                .warnings()
                .iter()
                .map(|warning| warning.message.clone())
                .collect::<Vec<_>>(),
            order.map(|path| format!("warning {path}"))
        );
        if let GraphError::Attempt { failures, .. } = &actual {
            assert_eq!(failures.len(), if cross_link { 1 } else { 2 });
            if !cross_link {
                assert!(failures[0].to_string().contains("page-001"));
                assert!(failures[1].to_string().contains("page-003"));
            }
        } else {
            panic!("expected grouped validation failures");
        }
        assert_eq!(probe.renders.lock().unwrap().len(), 4);
    }
}
