//! Capture bounds transient inputs and retains the same routes and byte charges.

use std::sync::{Arc, Mutex};

use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use unimock::{MockFn, Unimock, matching};

use super::capture_with_bound;
use super::comparison_capture_tests::source_calls;

struct Probe {
    generation: Arc<dyn RenderGeneration>,
    batches: Arc<Mutex<Vec<Vec<String>>>>,
    reads: Arc<Mutex<Vec<String>>>,
}

fn captured(count: usize, parallelism: usize, bound: usize) -> Probe {
    let batches = Arc::new(Mutex::new(Vec::new()));
    let recorded = batches.clone();
    let reads = Arc::new(Mutex::new(Vec::new()));
    let source = Arc::new(Unimock::new((
        source_calls("base", count, reads.clone()),
        RenderGenerationMock::comparison_parallelism
            .each_call(matching!())
            .returns(parallelism),
        RenderGenerationMock::comparison_batch
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |mock, routes| {
                recorded.lock().unwrap().push(routes.to_vec());
                routes
                    .iter()
                    .map(|route| mock.comparison_input(route))
                    .collect()
            })),
    )));
    Probe {
        generation: capture_with_bound(source, bound).unwrap(),
        batches,
        reads,
    }
}

#[test]
fn batches_scale_linearly_and_keep_every_route_in_authored_order() {
    let run = |count| {
        let probe = captured(count, 3, usize::MAX);
        let captured = probe.generation.comparison_capture().unwrap();
        assert_eq!(captured.views, count);
        let expected: Vec<_> = probe.generation.plans().keys().cloned().collect();
        let batches = probe.batches.lock().unwrap();
        assert!(
            batches
                .iter()
                .all(|batch| !batch.is_empty() && batch.len() <= 3)
        );
        assert_eq!(
            batches.iter().flatten().cloned().collect::<Vec<_>>(),
            expected
        );
        assert_eq!(probe.reads.lock().unwrap().len(), count);
        for route in &expected {
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
        assert_eq!(probe.reads.lock().unwrap().len(), count);
        batches.len()
    };
    let small = run(8);
    assert!(small > 0);
    assert!(run(32) as f64 <= 4.5 * small as f64);
}

#[test]
fn batching_preserves_exact_retention_charges_and_partial_fallback_routes() {
    let full = captured(8, 1, usize::MAX);
    let full_weight = full.generation.comparison_capture().unwrap().retained_bytes;
    for bound in [full_weight, full_weight / 2] {
        let serial = captured(8, 1, bound);
        let parallel = captured(8, 3, bound);
        let left = serial.generation.comparison_capture().unwrap();
        let right = parallel.generation.comparison_capture().unwrap();
        assert_eq!(left.views, right.views);
        assert_eq!(left.retained_bytes, right.retained_bytes);
        assert_eq!(left.encoded_bytes, right.encoded_bytes);
        assert!(right.retained_bytes <= bound);
        if bound < full_weight {
            assert!(right.views > 0 && right.views < 8);
        }
        for route in serial.generation.plans().keys() {
            serial.reads.lock().unwrap().clear();
            parallel.reads.lock().unwrap().clear();
            assert_eq!(
                serial.generation.render(route).unwrap().bytes,
                parallel.generation.render(route).unwrap().bytes
            );
            assert_eq!(
                *serial.reads.lock().unwrap(),
                *parallel.reads.lock().unwrap()
            );
        }
    }
}

#[test]
fn zero_capacity_uses_single_view_batches() {
    let probe = captured(2, 0, usize::MAX);
    assert_eq!(probe.generation.comparison_capture().unwrap().views, 2);
    assert_eq!(
        probe
            .batches
            .lock()
            .unwrap()
            .iter()
            .map(Vec::len)
            .collect::<Vec<_>>(),
        [1, 1]
    );
}
