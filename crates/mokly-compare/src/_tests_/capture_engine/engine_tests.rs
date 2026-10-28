//! The full engine never revisits a fitting base, even with evicted generated assets.

use std::sync::Arc;

use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::{material, namespace};

use crate::comparison_capture::{self, CaptureSide};
use crate::comparison_types::Comparison;

use super::support::{self, Probe, STYLES};

#[test]
fn engine_batches_base_reads_at_one_to_four_sizes_and_keeps_the_head_source() {
    let run = |count| {
        let probe = Arc::new(Probe {
            forbid_base_after_head: true,
            capture_base: true,
            ..Default::default()
        });
        let before = support::generation("base", count, probe.clone(), 0);
        let after = support::generation("head", count, probe.clone(), 0);
        let engine = support::engine();
        let before = engine.capture_base(before).unwrap();
        let result = engine
            .compare_prepared(&support::request(), before, after.clone())
            .unwrap();
        assert!(
            Arc::ptr_eq(&result.after, &after),
            "head must keep its original bounded cache"
        );
        let reused = comparison_capture::capture(result.before.clone(), CaptureSide::Base).unwrap();
        assert!(Arc::ptr_eq(&reused, &result.before));
        let retained = reused.comparison_capture().unwrap();
        assert_eq!(retained.views, count);
        assert!(retained.encoded_bytes > 0);
        assert!(retained.retained_bytes >= retained.encoded_bytes);
        assert_eq!(result.counts.changes, count);
        assert_eq!(result.entries.len(), count);
        for entry in &result.entries {
            let index = entry.path.strip_prefix("page-").unwrap();
            for view in &entry.documents {
                assert_eq!(
                    view.evidence.resources,
                    [ResourceEvidence {
                        path: namespace::generated(&format!("assets/{index}.png")),
                        owner: EvidenceOwner::Entry,
                    }]
                );
            }
        }
        for index in 0..count {
            let route = format!("page-{index}/index.html");
            assert!(
                result
                    .before
                    .render(&route)
                    .unwrap()
                    .bytes
                    .starts_with(b"<!doctype html>")
            );
            assert!(
                result
                    .after
                    .render(&route)
                    .unwrap()
                    .bytes
                    .starts_with(b"<!doctype html>")
            );
            assert_eq!(result.before.closure(&route).unwrap().evidence.len(), 3);
            assert_eq!(
                result
                    .before
                    .resource_digest(&namespace::generated(&format!("assets/{index}.png")))
                    .unwrap(),
                Some(material::digest(format!("base-{index}").as_bytes()))
            );
        }
        for route in STYLES {
            assert_eq!(
                result
                    .before
                    .resource_bytes(&namespace::generated(route))
                    .unwrap(),
                Some(b"p { outline-color: red; }".to_vec())
            );
        }
        let events = probe.events.lock().unwrap();
        let base = events.iter().filter(|(side, _, _)| *side == "base").count();
        let head = events.iter().filter(|(side, _, _)| *side == "head").count();
        let switches = 1 + events
            .windows(2)
            .filter(|pair| pair[0].0 != pair[1].0)
            .count();
        assert_eq!(switches, 2);
        assert_eq!(
            events
                .iter()
                .filter(|(side, op, _)| *side == "base" && *op == "digest")
                .count(),
            count
        );
        assert_eq!(
            events
                .iter()
                .filter(|(side, op, _)| *side == "base" && *op == "generated")
                .count(),
            2
        );
        assert_eq!(
            events
                .iter()
                .filter(|(side, op, _)| *side == "head" && *op == "digest")
                .count(),
            count
        );
        assert!(
            events
                .iter()
                .all(|(side, _, head)| *side != "base" || !head)
        );
        (base, head, switches)
    };
    let small = run(4);
    let large = run(16);
    assert!(small.0 > 0 && small.1 > 0);
    assert!(large.0 * 2 <= small.0 * 9);
    assert!(large.1 * 2 <= small.1 * 9);
    assert_eq!(small.2, large.2);
}
