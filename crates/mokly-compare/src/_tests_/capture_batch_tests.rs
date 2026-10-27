//! Real capture retention and fallback consume the shared batched fake producer.

use std::sync::{Arc, Mutex};

use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use unimock::{MockFn, Unimock, matching};

use super::comparison_capture_tests::source_calls;
use super::{CaptureSide, capture_with_bound};

struct Probe {
    generation: Arc<dyn RenderGeneration>,
    reads: Arc<Mutex<Vec<String>>>,
}

fn captured(count: usize, parallelism: usize, bound: usize) -> Probe {
    let reads = Arc::new(Mutex::new(Vec::new()));
    let source = Arc::new(Unimock::new((
        source_calls("base", count, reads.clone()),
        RenderGenerationMock::comparison_parallelism
            .each_call(matching!())
            .returns(parallelism),
    )));
    Probe {
        generation: capture_with_bound(source, bound, CaptureSide::Base).unwrap(),
        reads,
    }
}

#[test]
fn retained_inputs_replay_without_more_source_reads_at_one_and_four_sizes() {
    let run = |count| {
        let probe = captured(count, 3, usize::MAX);
        assert_eq!(probe.generation.comparison_capture().unwrap().views, count);
        let summary = probe.generation.render_all().unwrap();
        assert_eq!(summary.documents, count);
        assert_eq!(summary.closure.len(), count);
        let routes: Vec<_> = probe.generation.plans().keys().cloned().collect();
        for route in &routes {
            assert_eq!(
                probe.generation.render(route).unwrap().bytes,
                format!("base:{route}").as_bytes()
            );
            assert!(
                probe
                    .generation
                    .closure(route)
                    .unwrap()
                    .files
                    .contains(route)
            );
        }
        let reads = probe.reads.lock().unwrap().len();
        assert_eq!(reads, count);
        reads
    };
    let small = run(8);
    assert!(small > 0);
    assert_eq!(run(32), 4 * small);
}

#[test]
fn growing_summary_is_charged_and_partial_capture_preserves_fallback_bytes() {
    let full = captured(8, 1, usize::MAX);
    let full_weight = full.generation.comparison_capture().unwrap().retained_bytes;
    for parallelism in [1, 3] {
        for bound in [full_weight, full_weight / 2] {
            let probe = captured(8, parallelism, bound);
            let retained = probe.generation.comparison_capture().unwrap();
            assert!(retained.retained_bytes <= bound);
            assert_eq!(probe.generation.render_all().unwrap().closure.len(), 8);
            if bound == full_weight {
                assert_eq!(retained.views, 8);
                assert_eq!(retained.retained_bytes, full_weight);
            } else {
                assert!(retained.views > 0 && retained.views < 8);
            }
            probe.reads.lock().unwrap().clear();
            for route in probe.generation.plans().keys() {
                assert_eq!(
                    probe.generation.comparison_document(route).unwrap().bytes,
                    full.generation.comparison_document(route).unwrap().bytes
                );
            }
            assert_eq!(probe.reads.lock().unwrap().len(), 8 - retained.views);
        }
    }
}
